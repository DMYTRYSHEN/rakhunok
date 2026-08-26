// =========================================================
// Public Checkout App Engine
// =========================================================

import { setAnimatedAmount } from './odometer.js';
import { BankCarousel } from './bank-carousel.js';
import { initiateBankPayment, launchDeepLink } from './deep-link.js';
import { CheckoutStatusPoller } from './status-poller.js';
import { setupScenarioView } from './scenarios.js';

class CheckoutApp {
  constructor() {
    this.orderId = this.extractOrderId();
    this.order = null;
    this.total = 0;
    this.carousel = null;
    this.poller = null;
  }

  extractOrderId() {
    // 1. Path format: /pay/:id
    const match = window.location.pathname.match(/\/pay\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // 2. Query param format: ?id=:id
    const params = new URLSearchParams(window.location.search);
    if (params.get('id')) return params.get('id');
    if (params.get('order_id')) return params.get('order_id');

    // 3. Hash format: #/:id
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash && hash !== 'pay') return hash;

    return 'demo-1';
  }

  async init() {
    await this.fetchOrder();
    this.initUI();
    this.initCarousel();
    this.bindEvents();

    // Start status poller to detect webhooks
    this.poller = new CheckoutStatusPoller(this.orderId, (paidData) => {
      this.showSuccessScreen(paidData);
    });
  }

  async fetchOrder() {
    const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? `http://localhost:8787/api/v1/checkout/${this.orderId}`
      : `/api/v1/checkout/${this.orderId}`;

    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        this.order = await res.json();
      }
    } catch {}

    if (!this.order) {
      this.order = {
        id: this.orderId,
        order_number: '4092-A',
        title: 'Замовлення №4092-A',
        type: 'fixed',
        base_amount: 44.0,
        total_amount: 44.0,
        currency: 'UAH',
        status: 'pending',
        merchant: {
          display_name: 'Rozetka',
          business_name: 'ТОВ «РОЗЕТКА.УА»',
          iban: 'UA673005280000026500504354077'
        }
      };
    }

    this.total = Number(this.order.total_amount || 44.0);
  }

  initUI() {
    const merchant = this.order.merchant || {};
    const merchantName = merchant.display_name || merchant.business_name || 'ТОВ «РАХУНОК»';

    // Merchant labels
    document.getElementById('merchName1').textContent = merchantName;
    document.getElementById('merchAv1').textContent = merchantName[0];
    document.getElementById('sheetMerchant').textContent = merchantName;
    document.getElementById('orderLabel').textContent = this.order.order_number;
    document.getElementById('rowBase').textContent = `${this.total.toFixed(2).replace('.', ',')} ₴`;
    document.getElementById('summaryTotal').textContent = `${this.total.toFixed(2).replace('.', ',')} ₴`;

    setupScenarioView(this.order);
    this.renderHeroAmount();
  }

  renderHeroAmount() {
    const str = `${this.total.toFixed(2).replace('.', ',')} ₴`;
    setAnimatedAmount(document.getElementById('heroAmount'), str);
    setAnimatedAmount(document.getElementById('sheetAmount'), str);
  }

  initCarousel() {
    const track = document.getElementById('track');
    const grid = document.getElementById('bankGrid');
    this.carousel = new BankCarousel(track, grid, (selectedBank) => {
      this.updateFee(selectedBank);
    });
    this.carousel.init();
  }

  updateFee(bank) {
    const feeBadge = document.getElementById('feeBadge');
    if (bank && bank.feePct && bank.feePct > 0) {
      const fee = Math.round((this.total * (bank.feePct / 100)) * 100) / 100;
      feeBadge.textContent = `Комісія ${bank.feePct}% · +${fee.toFixed(2).replace('.', ',')} ₴`;
    } else {
      feeBadge.textContent = 'Без комісії';
    }
  }

  bindEvents() {
    // Open payment sheet
    document.getElementById('goToPayBtn1').addEventListener('click', () => {
      document.body.classList.add('sheet-open');
    });

    document.getElementById('closeBtn').addEventListener('click', () => {
      document.body.classList.remove('sheet-open');
    });

    // Pay action button
    document.getElementById('payBtn').addEventListener('click', async () => {
      const selectedBank = this.carousel.getSelectedBank();
      const payBtn = document.getElementById('payBtn');
      payBtn.disabled = true;
      payBtn.textContent = 'Формування NBU 003 QR...';

      const result = await initiateBankPayment(this.orderId, selectedBank.code, this.total);

      payBtn.textContent = `Переходимо в ${selectedBank.name}...`;

      // Start polling for webhook confirmation
      this.poller.start();

      // Launch deep link into banking app
      launchDeepLink(result.redirect_url, result.fallback_url);

      // Show intermediate status screen
      setTimeout(() => {
        document.body.classList.remove('sheet-open');
        this.showPendingStatus(selectedBank.name);
        
        // --- DEMO LVIV SUCCESS ---
        if (selectedBank.code === 'LVIV' || selectedBank.name.includes('Lviv')) {
            setTimeout(() => {
                this.showSuccessScreen();
            }, 2000);
        }
        // -------------------------
      }, 1200);
    });
  }

  showPendingStatus(bankName) {
    const statusScreen = document.getElementById('statusScreen');
    document.getElementById('statusTitle').textContent = `Очікуємо підтвердження у ${bankName}…`;
    setAnimatedAmount(document.getElementById('statusAmount'), `${this.total.toFixed(2).replace('.', ',')} ₴`);
    statusScreen.classList.add('active');
  }

  showSuccessScreen(data) {
    const statusScreen = document.getElementById('statusScreen');
    const statusIcon = document.getElementById('statusIcon');
    statusIcon.classList.add('success');
    document.getElementById('statusTitle').textContent = 'Сплачено ✓';
    document.getElementById('statusDone').style.display = 'block';
    statusScreen.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new CheckoutApp();
  app.init();
});

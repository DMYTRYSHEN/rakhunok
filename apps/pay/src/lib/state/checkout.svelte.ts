import { DEFAULT_BANKS } from '../config/banks.js';
import { DEFAULT_PROFILES } from '../config/profiles.js';
import { resolveScenario } from '../config/scenarios.js';
import { fetchBanksCatalog, fetchCheckoutOrder, initiateBankPayment } from '../services/api.js';
import { detectOS, launchDeepLink } from '../services/deeplink.js';
import { isOrderFresh } from '../services/expiry.js';
import { generateNbuQrPayload, buildBankRedirect } from '../services/qr-generator.js';
import { executeTurnstile, getCachedTurnstileToken } from '../services/turnstile.js';
import type { Bank } from '../types/bank.js';
import type { DeliveryDetails, FiscalReceipt, LoyaltyCard, Order, OrderItem, PlatformSplit, Terminal, UpsellItem } from '../types/order.js';
import type { ResolvedScenario, ScenarioDefinition } from '../types/scenario.js';

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

export function formatNumber(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getInitialOrderFromWindow(): Order | null {
  if (typeof window !== 'undefined') {
    const win = window as unknown as { __INITIAL_ORDER__?: Order };
    if (win.__INITIAL_ORDER__ && typeof win.__INITIAL_ORDER__ === 'object' && win.__INITIAL_ORDER__.id) {
      return win.__INITIAL_ORDER__;
    }
  }
  return null;
}

const initialOrderStatic = getInitialOrderFromWindow();

class CheckoutStore {
  order = $state<Order | null>(initialOrderStatic);
  orderId = $state<string>(initialOrderStatic?.id || 'demo-1');
  forcedScenario = $state<string>('');
  terminal = $state<Terminal | null>(initialOrderStatic?._terminal || null);
  legacyTtlMinutes = $state<number>(30);

  // Status
  stateScreenType = $state<'loading' | 'error'>('loading');
  errorTitle = $state<string>('Відкриваємо рахунок');
  errorMessage = $state<string>('Перевіряємо актуальну суму та реквізити.');
  isLoaded = $state<boolean>(Boolean(initialOrderStatic));

  // Theme
  theme = $state<'dark' | 'light'>('dark');

  // Modals & Overlays
  isSheetOpen = $state<boolean>(false);
  isActionSheetOpen = $state<boolean>(false);
  isStatusScreenOpen = $state<boolean>(false);
  statusState = $state<'pending' | 'success' | 'timeout'>('pending');
  toastMessage = $state<string | null>(null);
  toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Keypad / Custom Amount (Scenario 2)
  keypadValue = $state<string>('');

  // Line Items & Upsells (Order Bump)
  orderItems = $state<OrderItem[]>([]);
  upsellItems = $state<UpsellItem[]>([]);

  // Tips (HoReCa / Waiters / Table)
  tipAmount = $state<number>(0);
  tipPercentage = $state<number | null>(null);
  tipNote = $state<string>('');

  // Charity Round-Up for ZSU 🇺🇦
  isRoundUpActive = $state<boolean>(false);
  showRoundUp = $state<boolean>(false);

  // Loyalty & Cashback
  availableBonusPoints = $state<number>(0);
  useBonuses = $state<boolean>(false);
  loyaltyCard = $state<LoyaltyCard | null>(null);
  isLoyaltyScannerOpen = $state<boolean>(false);

  // Digital Platforms Law compliance card
  showComplianceCard = $state<boolean>(false);

  // Split the Bill (Table Scenario)
  splitMode = $state<'none' | 'equal' | 'custom'>('none');
  splitPersons = $state<number>(2);
  splitCustomAmount = $state<number>(0);

  // Donation / Banka
  donationAmount = $state<number>(200);
  donationComment = $state<string>('');
  isAnonymousDonation = $state<boolean>(false);

  // NPS Rating & Reviews
  npsRating = $state<number>(0);
  npsFeedback = $state<string>('');
  npsSubmitted = $state<boolean>(false);

  // Fiscal Receipt, BNPL & Nova Poshta Tracking
  isFiscalReceiptOpen = $state<boolean>(false);
  isBnplSheetOpen = $state<boolean>(false);
  isNpTrackingOpen = $state<boolean>(false);

  // Promo
  promoCode = $state<string>('');
  promoApplied = $state<boolean>(false);
  promoDiscount = $state<number>(0);

  // Delivery
  delivery = $state<DeliveryDetails>({
    name: '',
    phone: '',
    method: 'branch',
    city: '',
    branch: '',
    price: 0
  });

  // Banks & Payment
  banks = $state<Bank[]>(DEFAULT_BANKS);
  selectedBankIndex = $state<number>(0);
  isProcessingPayment = $state<boolean>(false);
  statusPollingInterval: ReturnType<typeof setInterval> | null = null;

  // Derived Values
  itemsTotal = $derived.by(() => {
    if (this.orderItems.length > 0) {
      return this.orderItems.reduce((acc, item) => acc + item.price * item.qty, 0);
    }
    return Number(this.order?.base_amount ?? this.order?.total_amount ?? 0);
  });

  baseAmount = $derived.by(() => {
    if (
      this.order?.type === 'open_amount' ||
      this.forcedScenario === 'amount' ||
      this.forcedScenario === 'open_amount' ||
      this.forcedScenario === '2'
    ) {
      const parsed = parseFloat(this.keypadValue.replace(',', '.'));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }
    if (this.order?.type === 'tips' || this.forcedScenario === 'tips') {
      return this.tipAmount > 0 ? this.tipAmount : 50;
    }
    if (
      this.order?.type === 'donation' ||
      this.forcedScenario === 'donation' ||
      this.forcedScenario === 'banc' ||
      this.forcedScenario === 'donate'
    ) {
      return this.donationAmount > 0 ? this.donationAmount : 200;
    }
    return this.itemsTotal;
  });

  tableBaseAmount = $derived.by(() => {
    return this.itemsTotal;
  });

  tableShareAmount = $derived.by(() => {
    const base = this.tableBaseAmount;
    if (this.splitMode === 'equal' && this.splitPersons > 1) {
      return Math.ceil(base / this.splitPersons);
    }
    if (this.splitMode === 'custom' && this.splitCustomAmount > 0) {
      return this.splitCustomAmount;
    }
    return base;
  });

  bonusDiscount = $derived.by(() => {
    let discount = 0;
    if (this.useBonuses && this.availableBonusPoints > 0) {
      discount += Math.min(this.availableBonusPoints, this.baseAmount);
    }
    if (this.loyaltyCard && this.loyaltyCard.use_bonuses && this.loyaltyCard.bonus_balance > 0) {
      discount += Math.min(this.loyaltyCard.bonus_balance, Math.max(0, this.baseAmount - discount));
    }
    if (this.loyaltyCard && (this.loyaltyCard.discount_pct ?? 0) > 0) {
      const pctDiscount = round2((this.baseAmount * (this.loyaltyCard.discount_pct || 0)) / 100);
      discount += pctDiscount;
    }
    return Math.min(discount, this.baseAmount);
  });


  roundUpDiff = $derived.by(() => {
    const isTable =
      this.order?.type === 'table' ||
      this.forcedScenario === '3' ||
      this.forcedScenario === 'table';
    const current = isTable
      ? this.tableShareAmount - this.bonusDiscount
      : this.baseAmount - (this.promoApplied ? this.promoDiscount : 0) - this.bonusDiscount;
    if (current <= 0) return 10;
    const step = current > 500 ? 50 : (current > 100 ? 20 : 10);
    const target = Math.ceil(current / step) * step;
    const diff = round2(target - current);
    return diff > 0 ? diff : step;
  });

  roundUpAmount = $derived.by(() => {
    if (!this.isRoundUpActive) return 0;
    return this.roundUpDiff;
  });

  roundUpTarget = $derived.by(() => {
    const isTable =
      this.order?.type === 'table' ||
      this.forcedScenario === '3' ||
      this.forcedScenario === 'table';
    const current = isTable
      ? this.tableShareAmount - this.bonusDiscount
      : this.baseAmount - (this.promoApplied ? this.promoDiscount : 0) - this.bonusDiscount;
    return current + this.roundUpDiff;
  });

  // Digital Platforms Law (DAC7) Split Settlement Breakdown
  platformSplit = $derived.by<PlatformSplit>(() => {
    const merch = Math.max(
      0,
      round2(
        this.tableShareAmount -
          (this.promoApplied ? this.promoDiscount : 0) -
          this.bonusDiscount +
          (this.delivery.price > 0 ? this.delivery.price : 0)
      )
    );
    return {
      merchant_amount: merch,
      waiter_amount: this.tipAmount,
      charity_amount: this.roundUpAmount,
      is_compliant: true
    };
  });

  allowLoyalty = $derived.by(() => {
    const cfg = this.order?.scenario_config as Record<string, unknown> | undefined;
    if (cfg && typeof cfg.allow_loyalty === 'boolean') {
      return cfg.allow_loyalty;
    }
    return true;
  });

  allowPromo = $derived.by(() => {
    const cfg = this.order?.scenario_config as Record<string, unknown> | undefined;
    if (cfg && typeof cfg.allow_promo === 'boolean') {
      return cfg.allow_promo;
    }
    return true;
  });

  allowTips = $derived.by(() => {
    const cfg = this.order?.scenario_config as Record<string, unknown> | undefined;
    if (cfg && typeof cfg.allow_tips === 'boolean') {
      return cfg.allow_tips;
    }
    return true;
  });

  allowSplit = $derived.by(() => {
    const cfg = this.order?.scenario_config as Record<string, unknown> | undefined;
    if (cfg && typeof cfg.allow_split === 'boolean') {
      return cfg.allow_split;
    }
    return true;
  });

  totalAmount = $derived.by(() => {
    if (
      this.order?.type === 'table' ||
      this.forcedScenario === '3' ||
      this.forcedScenario === 'table'
    ) {
      let total = this.tableShareAmount;
      if (this.bonusDiscount > 0) {
        total = Math.max(0, round2(total - this.bonusDiscount));
      }
      if (this.tipAmount > 0) {
        total = round2(total + this.tipAmount);
      }
      if (this.roundUpAmount > 0) {
        total = round2(total + this.roundUpAmount);
      }
      return total;
    }

    let total = this.baseAmount;
    if (this.promoApplied) {
      total = Math.max(0, round2(total - this.promoDiscount));
    }
    if (this.bonusDiscount > 0) {
      total = Math.max(0, round2(total - this.bonusDiscount));
    }
    if (this.delivery.price > 0) {
      total = round2(total + this.delivery.price);
    }
    if (this.roundUpAmount > 0) {
      total = round2(total + this.roundUpAmount);
    }
    return total;
  });

  selectedBank = $derived.by(() => {
    return this.banks[this.selectedBankIndex] || null;
  });

  bankFee = $derived.by(() => {
    if (!this.selectedBank?.feePct) return 0;
    return round2((this.totalAmount * this.selectedBank.feePct) / 100);
  });

  payTotalAmount = $derived.by(() => {
    return round2(this.totalAmount + this.bankFee);
  });

  bnplMinMonthly = $derived.by(() => {
    const tot = this.totalAmount > 0 ? this.totalAmount : 1200;
    return Math.ceil(tot / 4);
  });

  nbuQr = $derived.by(() => {
    const merchant = this.order?.merchant;
    const recipientName = merchant?.business_name || this.merchantName || 'ФОП ДМИТРИШЕН';
    const recipientIban = merchant?.iban || 'UA12345678987654321345562';
    const recipientTaxId = merchant?.tax_id || '11212121212';
    const purpose = this.order?.description || this.order?.title || this.orderLabel || `Оплата замовлення ${this.order?.order_number || this.orderId}`;
    const orderNumber = this.order?.order_number || this.orderId;
    const amount = this.payTotalAmount > 0 ? this.payTotalAmount : (this.order?.total_amount || 0);

    return generateNbuQrPayload({
      amount,
      recipientName,
      recipientIban,
      recipientTaxId,
      purpose,
      orderNumber
    });
  });

  nbuRawString = $derived.by(() => this.nbuQr.rawString);
  nbuPayload = $derived.by(() => this.nbuQr.base64UrlPayload);
  currentBankRedirect = $derived.by(() => {
    const bankCode = this.selectedBank?.code || 'UNJS';
    const clientOS = detectOS();
    return buildBankRedirect(bankCode, this.nbuPayload, clientOS);
  });

  fiscalReceipt = $derived.by<FiscalReceipt>(() => {
    if (this.order?.fiscal_receipt) return this.order.fiscal_receipt;
    const now = new Date();
    const dateStr = now.toLocaleDateString('uk-UA') + ' ' + now.toLocaleTimeString('uk-UA');
    const tot = this.payTotalAmount > 0 ? this.payTotalAmount : 1240.0;
    const vat = round2((tot * 20) / 120);
    return {
      fiscal_number: '3000' + Math.floor(100000 + Math.random() * 900000),
      device_number: 'ПРРО-44819',
      tax_name: this.order?.merchant?.business_name || this.merchantName || 'ФОП ДМИТРИШЕН',
      tax_id: this.order?.merchant?.tax_id || '11212121212',
      date_time: dateStr,
      items: [
        {
          name: this.order?.title || this.orderLabel || 'Оплата замовлення',
          quantity: 1,
          price: tot,
          total: tot,
          tax_rate: '20% (А)'
        }
      ],
      vat_amount: vat,
      total_amount: tot,
      verification_url: 'https://cabinet.tax.gov.ua/cashregs/check'
    };
  });

  resolvedScenario = $derived.by<ResolvedScenario>(() => {
    return resolveScenario(
      this.order,
      this.terminal ? 'table' : this.forcedScenario,
      (typeof window !== 'undefined' &&
        (window as unknown as { __CHECKOUT_SCENARIOS__?: Record<string, Partial<ScenarioDefinition>> })
          .__CHECKOUT_SCENARIOS__) ||
        {}
    );
  });

  merchantName = $derived.by(() => {
    if (this.order?.type === 'tips' || this.forcedScenario === 'tips') {
      return this.order?.waiter?.name ? `Офіціант ${this.order.waiter.name}` : 'Чайові офіціанту';
    }
    if (
      this.order?.type === 'donation' ||
      this.forcedScenario === 'donation' ||
      this.forcedScenario === 'banc'
    ) {
      return this.order?.donation?.organizer || 'Благодійний збір';
    }
    return (
      this.order?.merchant?.display_name ||
      this.order?.merchant?.business_name ||
      'ФОП ДМИТРИШЕН'
    );
  });

  orderLabel = $derived.by(() => {
    if (this.order?.type === 'tips' || this.forcedScenario === 'tips') {
      return this.order?.waiter?.name ? `Чайові · ${this.order.waiter.name}` : 'Чайові офіціанту';
    }
    if (
      this.order?.type === 'donation' ||
      this.forcedScenario === 'donation' ||
      this.forcedScenario === 'banc'
    ) {
      return this.order?.donation?.goal_title || 'Волонтерський збір';
    }
    if (this.order?.table_number) {
      return `Столик ${this.order.table_number}`;
    }
    return this.order?.title || this.order?.order_number || 'Замовлення';
  });

  showToast(message: string, duration = 2200): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = null;
    }, duration);
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    vibrate(8);
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('light-mode', this.theme === 'light');
    }
  }

  openPaymentSheet(): void {
    this.isSheetOpen = true;
    if (typeof document !== 'undefined') {
      document.body.classList.add('sheet-open');
    }
    vibrate(10);
  }

  closePaymentSheet(): void {
    this.isSheetOpen = false;
    if (typeof document !== 'undefined') {
      document.body.classList.remove('sheet-open');
    }
  }

  openActionSheet(): void {
    this.isActionSheetOpen = true;
    vibrate(10);
  }

  closeActionSheet(): void {
    this.isActionSheetOpen = false;
  }

  applyPromo(code: string): boolean {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      this.showToast('Введіть промокод');
      return false;
    }
    if (this.promoApplied) return false;

    this.promoCode = trimmed;
    this.promoDiscount = Number(this.resolvedScenario.config?.promoDiscount ?? 4.0);
    this.promoApplied = true;
    vibrate([15, 40, 15]);
    this.showToast(`Знижку ${formatNumber(this.promoDiscount)} ₴ застосовано`);
    return true;
  }

  setKeypadDigit(k: string): void {
    vibrate(6);
    if (k === 'del') {
      this.keypadValue = this.keypadValue.slice(0, -1);
    } else if (k === ',') {
      if (this.keypadValue !== '' && !this.keypadValue.includes(',')) {
        this.keypadValue += ',';
      }
    } else {
      const [, dec] = this.keypadValue.split(',');
      if (dec !== undefined && dec.length >= 2) return;
      if (this.keypadValue.replace(',', '').length >= 7) return;
      if (this.keypadValue === '0' && k !== ',') {
        this.keypadValue = k;
      } else {
        this.keypadValue += k;
      }
    }
  }

  selectBank(index: number): void {
    if (index >= 0 && index < this.banks.length) {
      this.selectedBankIndex = index;
      vibrate(8);
    }
  }

  chooseAnotherBank(): void {
    vibrate(8);
    this.isStatusScreenOpen = false;
    this.statusState = 'pending';
    this.openPaymentSheet();
  }

  retryPayment(): void {
    vibrate(10);
    this.statusState = 'pending';
    this.executePay();
  }

  setTip(amount: number, pct: number | null = null): void {
    this.tipAmount = Math.max(0, round2(amount));
    this.tipPercentage = pct;
    vibrate(8);
  }

  setSplitMode(mode: 'none' | 'equal' | 'custom'): void {
    this.splitMode = mode;
    vibrate(8);
  }

  setSplitPersons(count: number): void {
    this.splitPersons = Math.max(2, Math.min(10, count));
    vibrate(6);
  }

  setSplitCustomAmount(amt: number): void {
    this.splitCustomAmount = Math.max(0, round2(amt));
  }

  setDonationAmount(amt: number): void {
    this.donationAmount = Math.max(10, round2(amt));
    vibrate(8);
  }

  setNpsRating(stars: number): void {
    this.npsRating = stars;
    vibrate(10);
  }

  submitNpsFeedback(): void {
    this.npsSubmitted = true;
    vibrate(15);
    this.showToast('Дякуємо за ваш відгук!');
  }

  openFiscalReceipt(): void {
    this.isFiscalReceiptOpen = true;
    vibrate(8);
  }

  closeFiscalReceipt(): void {
    this.isFiscalReceiptOpen = false;
  }

  openBnplSheet(): void {
    this.isBnplSheetOpen = true;
    vibrate(8);
  }

  closeBnplSheet(): void {
    this.isBnplSheetOpen = false;
  }

  addUpsell(item: UpsellItem): void {
    const existing = this.orderItems.find((i) => i.name === item.name);
    if (existing) {
      existing.qty += 1;
    } else {
      this.orderItems = [
        ...this.orderItems,
        {
          id: item.id,
          name: item.name,
          qty: 1,
          price: item.price,
          icon: item.icon
        }
      ];
    }
    vibrate(10);
    this.showToast(`Додано: ${item.name} (+${item.price} ₴)`);
  }

  removeOrderItem(id: string): void {
    this.orderItems = this.orderItems.filter((i) => i.id !== id);
    vibrate(6);
  }

  toggleRoundUp(): void {
    this.isRoundUpActive = !this.isRoundUpActive;
    vibrate(8);
  }

  toggleUseBonuses(): void {
    this.useBonuses = !this.useBonuses;
    vibrate(8);
  }

  openNpTracking(): void {
    this.isNpTrackingOpen = true;
    vibrate(8);
  }

  closeNpTracking(): void {
    this.isNpTrackingOpen = false;
  }

  openLoyaltyScanner(): void {
    this.isLoyaltyScannerOpen = true;
    vibrate(8);
  }

  closeLoyaltyScanner(): void {
    this.isLoyaltyScannerOpen = false;
  }

  applyLoyaltyCard(identifier: string): boolean {
    const trimmed = identifier.trim();
    if (!trimmed) {
      this.showToast('Введіть номер картки або телефон');
      return false;
    }

    let card: LoyaltyCard;
    if (
      trimmed.includes('2900') ||
      trimmed.toLowerCase().includes('сільпо') ||
      trimmed.toLowerCase().includes('silpo')
    ) {
      card = {
        id: 'card-silpo',
        program_name: 'Сільпо Власний Рахунок',
        card_number: '2900 8472 9102',
        holder_name: 'Олександр В.',
        bonus_balance: 85,
        discount_pct: 0,
        tier: 'Преміум Гість',
        badge_color: 'linear-gradient(135deg, #ff8c00, #e52d27)',
        use_bonuses: true
      };
    } else if (
      trimmed.includes('9900') ||
      trimmed.toLowerCase().includes('fishka') ||
      trimmed.toLowerCase().includes('фішка')
    ) {
      card = {
        id: 'card-fishka',
        program_name: 'OKKO Fishka Club',
        card_number: '9900 4821 7392',
        holder_name: 'Олександр В.',
        bonus_balance: 220,
        discount_pct: 0,
        tier: 'Fishka Platinum',
        badge_color: 'linear-gradient(135deg, #0575e6, #00f260)',
        use_bonuses: true
      };
    } else {
      const last4 = trimmed.replace(/\D/g, '').slice(-4) || '8821';
      card = {
        id: 'card-rozetka',
        program_name: 'Rozetka Club VIP',
        card_number: `ROZ •••• ${last4}`,
        holder_name: 'Олександр В.',
        bonus_balance: 150,
        discount_pct: 5,
        tier: 'Gold Member · Знижка 5%',
        badge_color: 'linear-gradient(135deg, #00b09b, #96c93d)',
        use_bonuses: true
      };
    }

    this.loyaltyCard = card;
    vibrate([20, 60, 20]);
    this.showToast(`Картку ${card.program_name} підключено!`);
    return true;
  }

  toggleLoyaltyBonusUsage(): void {
    if (this.loyaltyCard) {
      this.loyaltyCard = {
        ...this.loyaltyCard,
        use_bonuses: !this.loyaltyCard.use_bonuses
      };
      vibrate(8);
      this.showToast(
        this.loyaltyCard.use_bonuses
          ? `Списання ${formatNumber(this.loyaltyCard.bonus_balance)} ₴ увімкнено`
          : 'Накопичуватиметься кешбек'
      );
    }
  }

  removeLoyaltyCard(): void {
    this.loyaltyCard = null;
    vibrate(10);
    this.showToast('Картку лояльності відʼєднано');
  }


  async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Load banks catalog in background
    fetchBanksCatalog().then((list) => {
      if (list && list.length > 0) {
        this.banks = list;
      }
    });

    const params = new URLSearchParams(window.location.search);
    this.forcedScenario = (
      params.get('demo') ||
      params.get('sc') ||
      params.get('scenario') ||
      ''
    ).toLowerCase();

    let id = params.get('id') || params.get('order_id');
    if (!id) {
      const pathMatch = window.location.pathname.match(/\/(?:pay|checkout|o|t|tag|pos)\/([a-zA-Z0-9-]{3,36})/i);
      if (pathMatch) id = pathMatch[1];
    }
    if (!id && window.location.hash) {
      const hashMatch = window.location.hash.match(/([a-zA-Z0-9-]{3,36})/i);
      if (hashMatch) id = hashMatch[1];
    }
    if (!id && !this.forcedScenario) {
      id = localStorage.getItem('rahunok_last_order_id') || '';
    } else if (!id) {
      id = 'demo-1';
    }
    this.orderId = id;

    const requestedLegacyTtl = Number(params.get('ttl'));
    if (Number.isFinite(requestedLegacyTtl) && requestedLegacyTtl > 0) {
      this.legacyTtlMinutes = requestedLegacyTtl;
    }

    // Injected order from Worker
    const win = window as unknown as {
      __INITIAL_ORDER__?: Order;
      __INITIAL_TERMINAL__?: Terminal;
    };
    if (win.__INITIAL_TERMINAL__) this.terminal = win.__INITIAL_TERMINAL__;
    let initialOrder: Order | null = initialOrderStatic || win.__INITIAL_ORDER__ || null;
    if (initialOrder?._terminal) this.terminal = initialOrder._terminal;

    let checkoutLoadReason: string | null = null;
    if (!initialOrder && this.orderId && this.orderId !== 'demo-1' && !this.orderId.startsWith('demo-')) {
      const result = await fetchCheckoutOrder(this.orderId);
      initialOrder = result.order;
      checkoutLoadReason = result.reason;
      if (initialOrder?._terminal) this.terminal = initialOrder._terminal;
    }

    // Offline cache fallback
    if (!initialOrder && !this.forcedScenario && checkoutLoadReason === 'offline') {
      if (this.terminal) {
        const rawTableStored = localStorage.getItem('rahunok_term_' + this.terminal.code);
        if (rawTableStored) {
          try {
            const parsed = JSON.parse(rawTableStored);
            if (parsed && Number(parsed.total_amount) > 0 && isOrderFresh(parsed)) {
              initialOrder = parsed;
            }
          } catch {
            // ignore
          }
        }
      }
      if (!initialOrder) {
        const rawStored =
          localStorage.getItem('rahunok_order_' + this.orderId) ||
          localStorage.getItem('rahunok_order_' + (this.orderId.slice ? this.orderId.slice(0, 6) : this.orderId)) ||
          localStorage.getItem('rahunok_last_order');
        if (rawStored) {
          try {
            initialOrder = JSON.parse(rawStored);
          } catch {
            // ignore
          }
        }
      }
    }

    // Terminal in preparing state fallback
    if (!initialOrder && !this.forcedScenario && this.terminal) {
      initialOrder = {
        id: 'term-' + this.terminal.code,
        order_number: this.terminal.name,
        title: `${this.terminal.name} · Рахунок готується`,
        type: 'table',
        table_number: this.terminal.name,
        status: 'preparing',
        total_amount: 0,
        base_amount: 0,
        merchant: { display_name: 'POS Термінал', business_name: 'Очікування касира', tax_id: '', iban: '' }
      };
    }

    // Preset demos for dev/demo fixtures ONLY if no real order was found
    if (!initialOrder) {
      if (this.forcedScenario === '1' || this.forcedScenario === 'fixed' || this.forcedScenario === 'order_classic') {
        initialOrder = {
          id: 'demo-sc1',
          order_number: '№4092-A',
          title: 'Замовлення №4092-A',
          type: 'fixed',
          status: 'pending',
        total_amount: 1240.0,
        base_amount: 1240.0,
        merchant: {
          display_name: 'Rozetka',
          business_name: 'ТОВ «РОЗЕТКА.УА»',
          tax_id: '37193071',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.orderItems = [];
      this.upsellItems = [];
      this.showRoundUp = false;
      this.availableBonusPoints = 0;
      this.showComplianceCard = false;
    } else if (
      this.forcedScenario === 'order_upsell' ||
      this.forcedScenario === 'order_items' ||
      this.forcedScenario === 'upsell'
    ) {
      initialOrder = {
        id: 'demo-sc1-upsell',
        order_number: '№4092-A',
        title: 'Замовлення №4092-A',
        type: 'fixed',
        status: 'pending',
        total_amount: 1240.0,
        base_amount: 1240.0,
        merchant: {
          display_name: 'Rozetka',
          business_name: 'ТОВ «РОЗЕТКА.УА»',
          tax_id: '37193071',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.orderItems = [
        { id: '1', name: 'Навушники бездротові Pro', qty: 1, price: 990.0 },
        { id: '2', name: 'Захисний чохол Silicone', qty: 1, price: 250.0 }
      ];
      this.upsellItems = [
        { id: 'u1', name: 'Кабель Type-C Fast', price: 120.0, icon: '' },
        { id: 'u2', name: 'Подарункове пакування', price: 45.0, icon: '' }
      ];
      this.showRoundUp = false;
      this.availableBonusPoints = 0;
      this.showComplianceCard = false;
    } else if (this.forcedScenario === 'order_full') {
      initialOrder = {
        id: 'demo-sc1-full',
        order_number: '№4092-A',
        title: 'Замовлення №4092-A',
        type: 'fixed',
        status: 'pending',
        total_amount: 1240.0,
        base_amount: 1240.0,
        merchant: {
          display_name: 'Rozetka',
          business_name: 'ТОВ «РОЗЕТКА.УА»',
          tax_id: '37193071',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.orderItems = [
        { id: '1', name: 'Навушники бездротові Pro', qty: 1, price: 990.0 },
        { id: '2', name: 'Захисний чохол Silicone', qty: 1, price: 250.0 }
      ];
      this.upsellItems = [
        { id: 'u1', name: 'Кабель Type-C Fast', price: 120.0, icon: '' },
        { id: 'u2', name: 'Подарункове пакування', price: 45.0, icon: '' }
      ];
      this.showRoundUp = true;
      this.availableBonusPoints = 50;
      this.showComplianceCard = false;
    } else if (this.forcedScenario === '2' || this.forcedScenario === 'open_amount' || this.forcedScenario === 'amount') {
      initialOrder = {
        id: 'demo-sc2',
        order_number: 'Каса',
        title: 'Оплата на касі',
        type: 'open_amount',
        total_amount: 0,
        base_amount: 0,
        status: 'pending',
        merchant: {
          display_name: "Кав'ярня «Крапка»",
          business_name: 'ФОП Ковальчук В.М.',
          tax_id: '3124567890',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.orderItems = [];
      this.upsellItems = [];
      this.showRoundUp = false;
      this.availableBonusPoints = 0;
      this.showComplianceCard = false;
    } else if (this.forcedScenario === '3' || this.forcedScenario === 'table_classic' || this.forcedScenario === 'table') {
      initialOrder = {
        id: 'demo-sc3',
        order_number: 'Рахунок №118',
        title: 'Столик 12 · Рахунок №118',
        type: 'table',
        table_number: 12,
        status: 'pending',
        total_amount: 386.0,
        base_amount: 386.0,
        merchant: {
          display_name: 'Бістро «Смак»',
          business_name: 'ТОВ «СМАК РЕСТО»',
          tax_id: '39281746',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.orderItems = [];
      this.upsellItems = [];
      this.showRoundUp = false;
      this.availableBonusPoints = 0;
      this.showComplianceCard = false;
    } else if (this.forcedScenario === 'table_items' || this.forcedScenario === 'table_upsell') {
      initialOrder = {
        id: 'demo-sc3-items',
        order_number: 'Рахунок №118',
        title: 'Столик 12 · Рахунок №118',
        type: 'table',
        table_number: 12,
        status: 'pending',
        total_amount: 386.0,
        base_amount: 386.0,
        merchant: {
          display_name: 'Бістро «Смак»',
          business_name: 'ТОВ «СМАК РЕСТО»',
          tax_id: '39281746',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.orderItems = [
        { id: '1', name: 'Паста Карбонара', qty: 1, price: 240.0 },
        { id: '2', name: 'Капучино на вівсяному', qty: 2, price: 73.0 }
      ];
      this.upsellItems = [
        { id: 'u1', name: 'Круасан з мигдалем', price: 55.0, icon: '' },
        { id: 'u2', name: 'Трюфельний соус', price: 25.0, icon: '' }
      ];
      this.showRoundUp = false;
      this.availableBonusPoints = 0;
      this.showComplianceCard = false;
    } else if (this.forcedScenario === 'table_full') {
      initialOrder = {
        id: 'demo-sc3-full',
        order_number: 'Рахунок №118',
        title: 'Столик 12 · Рахунок №118',
        type: 'table',
        table_number: 12,
        status: 'pending',
        total_amount: 386.0,
        base_amount: 386.0,
        merchant: {
          display_name: 'Бістро «Смак»',
          business_name: 'ТОВ «СМАК РЕСТО»',
          tax_id: '39281746',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.orderItems = [
        { id: '1', name: 'Паста Карбонара', qty: 1, price: 240.0 },
        { id: '2', name: 'Капучино на вівсяному', qty: 2, price: 73.0 }
      ];
      this.upsellItems = [
        { id: 'u1', name: 'Круасан з мигдалем', price: 55.0, icon: '' },
        { id: 'u2', name: 'Трюфельний соус', price: 25.0, icon: '' }
      ];
      this.showRoundUp = true;
      this.availableBonusPoints = 50;
      this.showComplianceCard = true;
    } else if (this.forcedScenario === 'waiting') {
      initialOrder = {
        id: 'demo-waiting',
        order_number: 'Столик 12',
        title: 'Столик 12 · Рахунок готується',
        type: 'table',
        table_number: 12,
        status: 'preparing',
        total_amount: 0,
        base_amount: 0,
        merchant: {
          display_name: 'Бістро «Смак»',
          business_name: 'ТОВ «СМАК РЕСТО»',
          tax_id: '39281746',
          iban: 'UA673005280000026500504354077'
        }
      };
    } else if (
      this.forcedScenario === '4' ||
      this.forcedScenario === 'delivery' ||
      this.forcedScenario === 'tracking' ||
      this.forcedScenario === 'np'
    ) {
      initialOrder = {
        id: 'demo-sc4',
        order_number: '№7731',
        title: 'Замовлення №7731 · Нова пошта',
        type: 'delivery',
        status: 'pending',
        total_amount: 1450.0,
        base_amount: 1450.0,
        merchant: {
          display_name: 'Крамниця «Файно»',
          business_name: 'ФОП Мельник І.П.',
          tax_id: '2987654321',
          iban: 'UA673005280000026500504354077'
        },
        np_tracking: {
          ttn: '2045089281921',
          sender_city: 'Київ',
          recipient_city: 'Львів',
          recipient_branch: 'Відділення №1 (вул. Городоцька, 112)',
          status_title: 'Прямує до міста призначення',
          estimated_delivery: 'Завтра, 14:00 - 18:00',
          sender_name: 'Крамниця «Файно»',
          weight: '1.2 кг',
          steps: [
            { title: 'Замовлення оформлено та оплачено', time: '04.09 14:32', done: true },
            { title: 'Прийнято у відділенні №42, м. Київ', time: '04.09 16:10', done: true },
            { title: 'Прямує до міста призначення (Львів)', time: '04.09 21:05', done: true, active: true },
            { title: 'Прибуде у Відділення №1 (вул. Городоцька, 112)', time: '05.09 до 18:00', done: false }
          ]
        }
      };
      this.orderItems = [
        { id: '1', name: 'Світшот Oversize Файно', qty: 1, price: 1250.0 },
        { id: '2', name: 'Шкарпетки фірмові', qty: 1, price: 200.0 }
      ];
      this.upsellItems = [
        { id: 'u1', name: 'Ароматизатор для авто', price: 65.0, icon: '' },
        { id: 'u2', name: 'Стікерпак «Файно»', price: 35.0, icon: '' }
      ];
      if (this.forcedScenario === 'tracking' || this.forcedScenario === 'np') {
        this.isNpTrackingOpen = true;
      }
    } else if (
      this.forcedScenario === 'tips' ||
      this.forcedScenario === 'waiter' ||
      this.forcedScenario === 'gratuity' ||
      this.forcedScenario === 'alex_waiter'
    ) {
      initialOrder = {
        id: 'demo-tips',
        order_number: 'Чайові',
        title: 'Подяка офіціанту',
        type: 'tips',
        status: 'pending',
        total_amount: 50.0,
        base_amount: 50.0,
        merchant: {
          display_name: 'Олександр',
          business_name: 'Ресторан «Смак»'
        },
        waiter: {
          name: 'Олександр',
          role: 'Офіціант бістро',
          caption: 'Збираю на навчання та подорож 🌍',
          rating: 4.96,
          presets: [20, 50, 100, 200],
          percentages: [10, 15, 20]
        }
      };
      this.tipAmount = 50.0;
    } else if (
      this.forcedScenario === 'donation' ||
      this.forcedScenario === 'banc' ||
      this.forcedScenario === 'donate' ||
      this.forcedScenario === 'jar' ||
      this.forcedScenario === 'army'
    ) {
      initialOrder = {
        id: 'demo-donation',
        order_number: 'Збір на ЗСУ',
        title: '10 FPV-дронів для 72-ї ОМБр',
        type: 'donation',
        status: 'pending',
        total_amount: 200.0,
        base_amount: 200.0,
        merchant: {
          display_name: 'БФ «Повернись живим»',
          business_name: 'Благодійний Фонд допомоги армії'
        },
        donation: {
          goal_title: '10 FPV-дронів для 72-ї ОМБр «Чорні Запорожці»',
          organizer: 'БФ «Повернись живим»',
          verified: true,
          target_amount: 200000,
          collected_amount: 145000,
          presets: [100, 200, 500, 1000]
        }
      };
      this.donationAmount = 200.0;
    } else if (
      this.forcedScenario === 'profile' ||
      this.forcedScenario === 'krapka' ||
      this.forcedScenario === 'student' ||
      this.forcedScenario === 'sofia' ||
      this.forcedScenario === 'taxi' ||
      this.forcedScenario === 'bondar' ||
      this.forcedScenario === '5'
    ) {
      const profileKey =
        this.forcedScenario === 'student' || this.forcedScenario === 'sofia'
          ? 'sofia'
          : this.forcedScenario === 'taxi' || this.forcedScenario === 'bondar'
            ? 'bondar'
            : 'krapka';
      const prof = DEFAULT_PROFILES[profileKey];
      initialOrder = {
        id: `profile-${prof.slug}`,
        order_number: prof.name,
        title: prof.name,
        type: 'profile',
        status: 'pending',
        total_amount: 0,
        base_amount: 0,
        merchant: {
          display_name: prof.name,
          business_name: prof.description
        },
        scenario_config: prof as unknown as Record<string, unknown>
      };
    } else if (this.forcedScenario === 'loading') {
      this.stateScreenType = 'loading';
      this.errorTitle = 'Відкриваємо рахунок';
      this.errorMessage = 'Перевіряємо актуальну суму та реквізити.';
      this.isLoaded = false;
      return;
    } else if (
      this.forcedScenario === 'timeout' ||
      this.forcedScenario === 'retry' ||
      this.forcedScenario === 'no-response' ||
      this.forcedScenario === 'failed'
    ) {
      initialOrder = {
        id: 'demo-sc1-timeout',
        order_number: '№4092-A',
        title: 'Замовлення №4092-A',
        type: 'fixed',
        status: 'pending',
        total_amount: 1240.0,
        base_amount: 1240.0,
        merchant: {
          display_name: 'Rozetka',
          business_name: 'ТОВ «РОЗЕТКА.УА»',
          tax_id: '37193071',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.statusState = 'timeout';
      this.isStatusScreenOpen = true;
    } else if (this.forcedScenario === 'receipt') {
      initialOrder = {
        id: 'demo-sc1-receipt',
        order_number: '№4092-A',
        title: 'Замовлення №4092-A',
        type: 'fixed',
        status: 'paid',
        total_amount: 1240.0,
        base_amount: 1240.0,
        merchant: {
          display_name: 'Rozetka',
          business_name: 'ТОВ «РОЗЕТКА.УА»',
          tax_id: '37193071',
          iban: 'UA673005280000026500504354077'
        },
        fiscal_receipt: {
          fiscal_number: '3000482910',
          device_number: 'ПРРО-44819',
          tax_name: 'ТОВ «РОЗЕТКА.УА»',
          tax_id: '37193071',
          date_time: '04.09.2026 14:32:05',
          items: [
            { name: 'Навушники бездротові Pro', quantity: 1, price: 990.0, total: 990.0, tax_rate: '20% (А)' },
            { name: 'Захисний чохол Silicone', quantity: 1, price: 250.0, total: 250.0, tax_rate: '20% (А)' }
          ],
          vat_amount: 206.67,
          total_amount: 1240.0,
          verification_url: 'https://cabinet.tax.gov.ua/cashregs/check'
        }
      };
      this.statusState = 'success';
      this.isStatusScreenOpen = true;
      this.isFiscalReceiptOpen = true;
    } else if (
      this.forcedScenario === 'all' ||
      this.forcedScenario === 'index' ||
      this.forcedScenario === 'menu' ||
      this.forcedScenario === 'catalog' ||
      this.forcedScenario === 'demos'
    ) {
      initialOrder = {
        id: 'demo-index',
        order_number: 'Каталог',
        title: 'Каталог сценаріїв',
        type: 'index',
        status: 'pending',
        total_amount: 0,
        base_amount: 0,
        merchant: {
          display_name: 'Платформа Рахунок',
          business_name: 'Всі доступні сценарії'
        }
      };
    } else if (this.forcedScenario === 'loyalty') {
      initialOrder = {
        id: 'demo-sc1-loyalty',
        order_number: '№4092-A',
        title: 'Замовлення №4092-A',
        type: 'fixed',
        status: 'pending',
        total_amount: 1240.0,
        base_amount: 1240.0,
        merchant: {
          display_name: 'Rozetka',
          business_name: 'ТОВ «РОЗЕТКА.УА»',
          tax_id: '37193071',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.orderItems = [
        { id: '1', name: 'Навушники бездротові Pro', qty: 1, price: 990.0 },
        { id: '2', name: 'Захисний чохол Silicone', qty: 1, price: 250.0 }
      ];
      this.isLoyaltyScannerOpen = true;
    } else if (
      this.forcedScenario === 'paid' ||
      this.forcedScenario === 'success' ||
      this.forcedScenario === 'paid_table' ||
      this.forcedScenario === 'paid_delivery'
    ) {
      const isTable = this.forcedScenario === 'paid_table' || params.get('type') === 'table';
      if (isTable) {
        initialOrder = {
          id: 'demo-sc3',
          order_number: 'Рахунок №118',
          title: 'Столик 12 · Рахунок №118',
          type: 'table',
          table_number: 12,
          status: 'paid',
          total_amount: 386.0,
          base_amount: 386.0,
          merchant: {
            display_name: 'Бістро «Смак»',
            business_name: 'ТОВ «СМАК РЕСТО»',
            tax_id: '39281746',
            iban: 'UA673005280000026500504354077',
            google_maps_url: 'https://maps.google.com'
          },
          fiscal_receipt: {
            fiscal_number: '3000482910',
            device_number: 'ПРРО-44819',
            tax_name: 'ТОВ «СМАК РЕСТО»',
            tax_id: '39281746',
            date_time: '04.09.2026 14:32:05',
            items: [
              { name: 'Паста Карбонара', quantity: 1, price: 240.0, total: 240.0, tax_rate: '20% (А)' },
              { name: 'Капучино на вівсяному', quantity: 2, price: 73.0, total: 146.0, tax_rate: '20% (А)' }
            ],
            vat_amount: 64.33,
            total_amount: 386.0,
            verification_url: 'https://cabinet.tax.gov.ua/cashregs/check'
          }
        };
        this.tipAmount = 40.0;
      } else {
        initialOrder = {
          id: 'demo-sc1',
          order_number: '№4092-A',
          title: 'Замовлення №4092-A',
          type: 'delivery',
          status: 'paid',
          total_amount: 1240.0,
          base_amount: 1240.0,
          merchant: {
            display_name: 'Rozetka',
            business_name: 'ТОВ «РОЗЕТКА.УА»',
            tax_id: '37193071',
            iban: 'UA673005280000026500504354077',
            google_maps_url: 'https://maps.google.com'
          },
          np_tracking: {
            ttn: '2045089281921',
            sender_city: 'Київ',
            recipient_city: 'Львів',
            recipient_branch: 'Відділення №1 (вул. Городоцька, 112)',
            status_title: 'Прямує до міста призначення 🚚',
            estimated_delivery: 'Завтра, 14:00 - 18:00',
            sender_name: 'ТОВ «РОЗЕТКА.УА»',
            weight: '0.85 кг',
            steps: [
              { title: 'Замовлення оформлено та оплачено', time: '04.09 14:32', done: true },
              { title: 'Прийнято у відділенні №42, м. Київ', time: '04.09 16:10', done: true },
              { title: 'Прямує до міста призначення (Львів)', time: '04.09 21:05', done: true, active: true },
              { title: 'Прибуде у Відділення №1 (вул. Городоцька, 112)', time: '05.09 до 18:00', done: false }
            ]
          },
          fiscal_receipt: {
            fiscal_number: '3000482910',
            device_number: 'ПРРО-44819',
            tax_name: 'ТОВ «РОЗЕТКА.УА»',
            tax_id: '37193071',
            date_time: '04.09.2026 14:32:05',
            items: [
              { name: 'Навушники бездротові Pro', quantity: 1, price: 990.0, total: 990.0, tax_rate: '20% (А)' },
              { name: 'Захисний чохол Silicone', quantity: 1, price: 250.0, total: 250.0, tax_rate: '20% (А)' }
            ],
            vat_amount: 206.67,
            total_amount: 1240.0,
            verification_url: 'https://cabinet.tax.gov.ua/cashregs/check'
          }
        };
      }
      this.statusState = 'success';
      this.isStatusScreenOpen = true;
    } else if (this.forcedScenario === 'pending') {
      initialOrder = {
        id: 'demo-sc1',
        order_number: '№4092-A',
        title: 'Замовлення №4092-A',
        type: 'fixed',
        status: 'pending',
        total_amount: 44.0,
        base_amount: 44.0,
        merchant: {
          display_name: 'Rozetka',
          business_name: 'ТОВ «РОЗЕТКА.УА»',
          tax_id: '37193071',
          iban: 'UA673005280000026500504354077'
        }
      };
      this.statusState = 'pending';
      const isExplicitDemo = this.orderId === 'demo-1' || this.orderId.startsWith('demo-');
      if (isExplicitDemo) {
        initialOrder = {
          id: this.orderId,
          order_number: '№4092-A',
          title: 'Замовлення №4092-A',
          type: 'fixed',
          status: 'pending',
          total_amount: 44.0,
          base_amount: 44.0,
          merchant: {
            display_name: 'Rozetka',
            business_name: 'ТОВ «РОЗЕТКА.УА»',
            tax_id: '37193071',
            iban: 'UA673005280000026500504354077'
          }
        };
      }
    }
  }

    if (!initialOrder) {
      const isOffline = checkoutLoadReason === 'offline';
      this.stateScreenType = 'error';
      this.errorTitle = isOffline ? 'Немає з’єднання' : 'Рахунок не знайдено';
      this.errorMessage = isOffline
        ? 'Перевірте інтернет-з’єднання та відкрийте рахунок ще раз.'
        : 'Посилання недійсне або термін дії рахунку завершився. Перевірте посилання у продавця.';
      this.isLoaded = true;
      return;
    }

    if (initialOrder) {
      if (!initialOrder.merchant) {
        initialOrder.merchant = {
          business_name: 'ФОП ДМИТРИШЕН',
          display_name: 'BARCODE',
          iban: 'UA12345678987654321345562',
          tax_id: '11212121212',
          bank_name: 'А-Банк'
        };
      } else {
        if (!initialOrder.merchant.business_name) {
          initialOrder.merchant.business_name = 'ФОП ДМИТРИШЕН';
        }
        if (!initialOrder.merchant.iban) {
          initialOrder.merchant.iban = 'UA12345678987654321345562';
        }
        if (!initialOrder.merchant.tax_id) {
          initialOrder.merchant.tax_id = '11212121212';
        }
        if (!initialOrder.merchant.bank_name) {
          initialOrder.merchant.bank_name = 'А-Банк';
        }
      }
    }

    this.order = initialOrder;
    if (this.order.status === 'paid') {
      this.statusState = 'success';
      this.isStatusScreenOpen = true;
    }
    this.isLoaded = true;
    if (params.get('loyalty') === '1' || params.get('scan') === '1') {
      this.isLoyaltyScannerOpen = true;
    }
  }

  async executePay(): Promise<void> {
    if (this.isProcessingPayment) return;
    this.isProcessingPayment = true;
    vibrate(15);

    const bank = this.selectedBank;
    const bankCode = bank?.code || 'UNJS';
    const isLvivDemo = bankCode === 'LVIV' || bank?.id === 'lviv';

    if (isLvivDemo) {
      setTimeout(() => {
        this.isProcessingPayment = false;
        this.closePaymentSheet();
        this.statusState = 'pending';
        this.isStatusScreenOpen = true;
        setTimeout(() => {
          this.statusState = 'success';
          vibrate([30, 50, 30]);
        }, 2000);
      }, 1200);
      return;
    }

    try {
      const token = await executeTurnstile('pay');
      const clientOS = detectOS();
      const result = await initiateBankPayment(this.orderId, bankCode, this.payTotalAmount, {
        os: clientOS,
        turnstileToken: token,
        recaptchaToken: token,
        merchantName: this.order?.merchant?.business_name || this.merchantName || 'ФОП ДМИТРИШЕН',
        merchantIban: this.order?.merchant?.iban || 'UA12345678987654321345562',
        merchantTaxId: this.order?.merchant?.tax_id || '11212121212',
        purpose: this.order?.description || this.order?.title || this.orderLabel || `Оплата замовлення ${this.order?.order_number || this.orderId}`,
        orderNumber: this.order?.order_number || this.orderId
      });

      if (result.redirect_url) {
        launchDeepLink(result.redirect_url, result.fallback_url);
      }

      // Start polling for payment confirmation
      this.startStatusPolling();

      setTimeout(() => {
        this.isProcessingPayment = false;
        this.closePaymentSheet();
        this.statusState = 'pending';
        this.isStatusScreenOpen = true;
      }, 1200);
    } catch (err: unknown) {
      this.isProcessingPayment = false;
      const msg = err instanceof Error ? err.message : 'Помилка ініціалізації платежу';
      alert(msg);
    }
  }

  startStatusPolling(): void {
    if (this.statusPollingInterval) clearInterval(this.statusPollingInterval);
    const apiBase = (window.location.hostname === 'localhost' && window.location.port !== '8787') ? 'http://localhost:8787' : '';

    this.statusPollingInterval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/v1/checkout/${encodeURIComponent(this.orderId)}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 'paid') {
            if (this.statusPollingInterval) clearInterval(this.statusPollingInterval);
            this.statusState = 'success';
            vibrate([30, 50, 30]);
          }
        }
      } catch {
        // ignore
      }
    }, 2000);

    // Stop after 8 minutes
    setTimeout(() => {
      if (this.statusPollingInterval) clearInterval(this.statusPollingInterval);
    }, 8 * 60 * 1000);
  }
}

export const checkout = new CheckoutStore();

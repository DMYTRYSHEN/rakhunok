// =========================================================
// Bank Carousel & Grid Component
// =========================================================

const DEFAULT_BANKS = [
  { name: 'Monobank', code: 'UNJS', bg: 'linear-gradient(135deg, #000000, #2c2c2e)', active: true },
  { name: 'Приват24', code: 'PBAN', bg: 'linear-gradient(135deg, #2e7d32, #1b5e20)', feePct: 0.5, active: true },
  { name: 'Sense Bank', code: 'SENS', bg: 'linear-gradient(135deg, #0d3264, #1a4f94)', active: true },
  { name: 'Абанк', code: 'ABUA', bg: 'linear-gradient(135deg, #9e9d24, #827717)', active: true },
  { name: 'ПУМБ', code: 'FUIB', bg: 'linear-gradient(135deg, #e53935, #b71c1c)', active: true },
  { name: 'Райффайзен Банк', code: 'AVAL', bg: 'linear-gradient(135deg, #fbc02d, #f57f17)', active: true },
  { name: 'NovaPay', code: 'NOVA', bg: 'linear-gradient(135deg, #f44336, #c62828)', active: true },
  { name: 'izibank', code: 'TASB', bg: 'linear-gradient(135deg, #ff9800, #e65100)', active: true },
  { name: 'Глобус Банк', code: 'GLBU', bg: 'linear-gradient(135deg, #0288d1, #01579b)', active: true }
];

export class BankCarousel {
  constructor(trackEl, gridEl, onSelect) {
    this.track = trackEl;
    this.grid = gridEl;
    this.onSelect = onSelect;
    this.banks = DEFAULT_BANKS;
    this.currentIndex = 0;
    this.trackWidth = 0;
    this.wrappers = [];
    this.cards = [];
  }

  async init() {
    try {
      const res = await fetch('/api/v1/banks');
      if (res.ok) {
        const list = await res.json();
        if (list && list.length > 0) {
          this.banks = list.map(b => ({
            name: b.name,
            code: b.code,
            bg: b.bg_gradient || b.bg || 'linear-gradient(135deg, #1c1c1e, #2c2c2e)',
            feePct: b.fee_pct || b.feePct || 0,
            active: b.is_active !== undefined ? b.is_active : true
          }));
        }
      }
    } catch {}

    this.render();
  }

  render() {
    this.track.innerHTML = '';
    this.grid.innerHTML = '';

    this.banks.forEach((bank, idx) => {
      // 1. Carousel Card
      const wrapper = document.createElement('div');
      wrapper.className = 'card-wrapper';
      wrapper.dataset.index = idx;
      wrapper.innerHTML = `
        <div class="bank-card" id="bcard-${idx}" style="--v2-bg: ${bank.bg};">
          <div class="card-top">
            <div class="bank-name">${bank.name}</div>
            <div class="bank-logo">${bank.code}</div>
          </div>
          <div class="card-bottom">
            <div class="iban">A2A · NBU 003</div>
          </div>
          <div class="card-bg-logo">${bank.code}</div>
        </div>
      `;
      wrapper.querySelector('.bank-card').addEventListener('click', () => {
        if (idx !== this.currentIndex) this.selectBank(idx, false);
      });
      this.track.appendChild(wrapper);

      // 2. Grid Tile
      const tile = document.createElement('div');
      tile.className = `grid-card ${idx === 0 ? 'selected' : ''}`;
      tile.style.background = bank.bg;
      tile.dataset.index = idx;
      tile.innerHTML = `
        <div class="card-top">
          <div class="bank-name" style="color: #fff;">${bank.name}</div>
        </div>
        <div class="card-bottom">
          <span style="font-size: 11px; opacity: 0.85; color: #fff;">${bank.code} · ${bank.feePct ? `${bank.feePct}%` : '0%'}</span>
        </div>
      `;
      tile.addEventListener('click', () => {
        this.selectBank(idx, true);
      });
      this.grid.appendChild(tile);
    });

    this.wrappers = this.track.querySelectorAll('.card-wrapper');
    this.cards = this.track.querySelectorAll('.bank-card');
    this.trackWidth = this.track.getBoundingClientRect().width;

    this.track.addEventListener('scroll', () => requestAnimationFrame(() => this.updateCards()));
    window.addEventListener('resize', () => {
      this.trackWidth = this.track.getBoundingClientRect().width;
      this.updateCards();
    });

    this.updateCards();
  }

  updateCards() {
    if (!this.trackWidth || this.wrappers.length === 0) return;
    const trackCenter = this.track.scrollLeft + (this.trackWidth / 2);
    let closestDistance = Infinity, activeIndex = 0;

    this.wrappers.forEach((wrapper, index) => {
      const card = this.cards[index];
      if (!card) return;
      const wrapperCenter = wrapper.offsetLeft + (wrapper.offsetWidth / 2);
      const distance = Math.abs(trackCenter - wrapperCenter);
      if (distance < closestDistance) { closestDistance = distance; activeIndex = index; }
      const normalized = Math.min(distance / wrapper.offsetWidth, 1);
      const scale = 1 - (normalized * 0.13);
      const opacity = 1 - (normalized * 0.45);
      const direction = wrapperCenter > trackCenter ? 1 : -1;
      card.style.transform = `scale(${scale}) perspective(900px) rotateY(${normalized * direction * -12}deg)`;
      card.style.opacity = opacity;
    });

    if (activeIndex !== this.currentIndex) {
      this.currentIndex = activeIndex;
      this.grid.querySelectorAll('.grid-card').forEach((t) =>
        t.classList.toggle('selected', Number(t.dataset.index) === this.currentIndex));
      if (this.onSelect) this.onSelect(this.banks[this.currentIndex]);
    }
  }

  selectBank(index, fromGrid) {
    const wrapper = this.wrappers[index];
    if (!wrapper) return;
    const pos = wrapper.offsetLeft - (this.trackWidth / 2) + (wrapper.offsetWidth / 2);
    if (this.track.scrollTo) this.track.scrollTo({ left: pos, behavior: 'smooth' });
    else this.track.scrollLeft = pos;
  }

  getSelectedBank() {
    return this.banks[this.currentIndex] || this.banks[0];
  }
}

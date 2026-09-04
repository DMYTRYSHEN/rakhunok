<script lang="ts">
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';
  import Odometer from '../components/Odometer.svelte';
  import type { DeliveryMethodConfig } from '../types/scenario.js';

  let step = $state<'overview' | 'recipient' | 'np'>('overview');

  let nameInput = $state(checkout.delivery.name || '');
  let phoneInput = $state(checkout.delivery.phone || '');
  let cityInput = $state(checkout.delivery.city || '');
  let branchInput = $state(checkout.delivery.branch || '');
  let selectedMethodId = $state<string>(checkout.delivery.method || 'branch');

  const defaultMethods: DeliveryMethodConfig[] = [
    {
      id: 'branch',
      name: 'У відділення',
      short: 'Відділення',
      price: 70.0,
      eta: '1–2 дні',
      addrLabel: 'Відділення',
      addrPh: 'Відділення №1'
    },
    {
      id: 'locker',
      name: 'У поштомат',
      short: 'Поштомат',
      price: 65.0,
      eta: '1–2 дні',
      addrLabel: 'Поштомат',
      addrPh: 'Поштомат №5231'
    },
    {
      id: 'courier',
      name: "Кур'єром за адресою",
      short: "Кур'єр",
      price: 120.0,
      eta: '1–3 дні',
      addrLabel: 'Адреса',
      addrPh: 'вул. Хрещатик, 1, кв. 5'
    }
  ];

  const methods = $derived<DeliveryMethodConfig[]>(
    checkout.resolvedScenario.config?.methods || defaultMethods
  );

  const currentMethod = $derived(
    methods.find((m) => m.id === selectedMethodId) || methods[0]
  );

  const isRecipientValid = $derived(
    nameInput.trim().length >= 3 && phoneInput.replace(/\D/g, '').length >= 10
  );

  const isNpValid = $derived(
    cityInput.trim().length >= 2 && branchInput.trim().length >= 1
  );

  function handleBack(): void {
    if (step === 'np') {
      step = 'recipient';
      vibrate(6);
    } else if (step === 'recipient') {
      step = 'overview';
      vibrate(6);
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  }

  function handleOverviewStart(): void {
    vibrate(8);
    if (checkout.delivery.price > 0 && isRecipientValid && isNpValid) {
      checkout.openPaymentSheet();
    } else {
      step = 'recipient';
    }
  }

  function handleRecipientNext(): void {
    if (!isRecipientValid) return;
    vibrate(8);
    step = 'np';
  }

  function handleSelectMethod(m: DeliveryMethodConfig): void {
    selectedMethodId = m.id;
    vibrate(6);
  }

  function handleNpFinish(): void {
    if (!isNpValid) return;
    vibrate(10);

    checkout.delivery = {
      name: nameInput.trim(),
      phone: phoneInput.trim(),
      method: currentMethod.id,
      city: cityInput.trim(),
      branch: branchInput.trim(),
      price: currentMethod.price
    };

    checkout.openPaymentSheet();
  }
</script>

<div class="screen-content">
  <nav class="order-nav">
    <button class="order-nav-btn back-btn" onclick={handleBack} aria-label="Назад">
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        stroke="currentColor"
        stroke-width="2.5"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>

    <div class="order-merchant">
      <div class="merchant-avatar">
        <img src="./logo.svg" alt="" />
      </div>
      <span class="order-merchant-name">{checkout.merchantName}</span>
    </div>

    <button
      class="order-nav-btn more-btn"
      onclick={() => checkout.openActionSheet()}
      aria-label="Дії"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        stroke="currentColor"
        stroke-width="2.5"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="19" cy="12" r="1"></circle>
        <circle cx="5" cy="12" r="1"></circle>
      </svg>
    </button>
  </nav>

  <div
    class="wizard-progress"
    style:opacity={step === 'overview' ? '0' : '1'}
  >
    <div
      class="wp-seg"
      class:done={step === 'recipient' || step === 'np'}
    ></div>
    <div class="wp-seg" class:done={step === 'np'}></div>
  </div>

  <!-- Step 0: Overview -->
  {#if step === 'overview'}
    <div class="wizard-step active">
      <section class="order-hero">
        <div class="order-hero-label">{checkout.orderLabel}</div>
        <div class="order-hero-amount">
          <Odometer value={formatNumber(checkout.totalAmount)} suffix=" ₴" />
        </div>
        <div>
          <div class="pay-status">
            <span class="st-dot"></span>
            <span>Очікує на оплату</span>
          </div>
        </div>

        {#if checkout.totalAmount >= 1000}
          <button class="bnpl-badge" onclick={() => checkout.openBnplSheet()}>
            <span class="bnpl-badge-pill">0%</span>
            <span>або від {checkout.bnplMinMonthly} ₴/міс у Monobank чи Приват24</span>
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        {/if}
      </section>

      <div class="order-card">
        <div class="summary-row">
          <span class="summary-label">Замовлення</span>
          <span class="summary-value">{formatNumber(checkout.baseAmount)} ₴</span>
        </div>

        <div class="summary-row">
          <span class="summary-label">Доставка · Нова пошта</span>
          <span class="summary-value dim">
            {checkout.delivery.price > 0
              ? `${formatNumber(checkout.delivery.price)} ₴`
              : 'за тарифом'}
          </span>
        </div>

        <div class="summary-row total">
          <span class="summary-label">До сплати</span>
          <span class="summary-value">{formatNumber(checkout.totalAmount)} ₴</span>
        </div>
      </div>

      <button class="order-cta" onclick={handleOverviewStart}>
        <span>Оформити доставку</span>
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Step 1: Recipient -->
  {#if step === 'recipient'}
    <div class="wizard-step active">
      <h2 class="wiz-title">Отримувач</h2>
      <p class="wiz-sub">Кому Нова пошта передасть замовлення</p>

      <div class="form-field">
        <label class="form-label" for="fName">Ім'я та прізвище</label>
        <input
          id="fName"
          bind:value={nameInput}
          type="text"
          class="wiz-input"
          placeholder="Тарас Шевченко"
          autocomplete="name"
        />
      </div>

      <div class="form-field">
        <label class="form-label" for="fPhone">Номер телефону</label>
        <input
          id="fPhone"
          bind:value={phoneInput}
          type="tel"
          class="wiz-input"
          placeholder="+380 __ ___ __ __"
          autocomplete="tel"
          inputmode="tel"
        />
      </div>

      <button
        class="order-cta"
        disabled={!isRecipientValid}
        onclick={handleRecipientNext}
      >
        Далі
      </button>
    </div>
  {/if}

  <!-- Step 2: Nova Poshta options -->
  {#if step === 'np'}
    <div class="wizard-step active">
      <h2 class="wiz-title">Доставка Новою поштою</h2>
      <p class="wiz-sub">Оберіть спосіб та адресу отримання</p>

      <div class="method-list">
        {#each methods as m}
          <button
            class="method-row"
            class:selected={m.id === selectedMethodId}
            onclick={() => handleSelectMethod(m)}
          >
            <span class="method-radio"></span>
            <span class="method-text">
              <span class="method-name">{m.name}</span>
              <span class="method-eta" style="display:block;">{m.eta}</span>
            </span>
            <span class="method-price">{formatNumber(m.price)} ₴</span>
          </button>
        {/each}
      </div>

      <div class="form-field">
        <label class="form-label" for="fCity">Місто</label>
        <input
          id="fCity"
          bind:value={cityInput}
          type="text"
          class="wiz-input"
          placeholder="Київ"
          autocomplete="address-level2"
        />
      </div>

      <div class="form-field">
        <label class="form-label" for="fBranch">{currentMethod.addrLabel}</label>
        <input
          id="fBranch"
          bind:value={branchInput}
          type="text"
          class="wiz-input"
          placeholder={currentMethod.addrPh}
        />
      </div>

      <button
        class="order-cta"
        disabled={!isNpValid}
        onclick={handleNpFinish}
      >
        Перейти до оплати
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  {/if}
</div>

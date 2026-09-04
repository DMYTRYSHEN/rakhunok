<script lang="ts">
  import { checkout, vibrate } from '../state/checkout.svelte.js';
  import type { ProfileData, ProfileMetaItem } from '../types/profile.js';

  let selectedPreset = $state<number | null>(null);
  let customAmountInput = $state<string>('');

  const profile = $derived<ProfileData | null>(
    (checkout.order?.scenario_config as unknown as ProfileData) || null
  );

  function getMetaIconSvg(icon: string): string {
    if (icon === 'pin') {
      return '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
    }
    if (icon === 'clock') {
      return '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
    }
    if (icon === 'star') {
      return '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    }
    if (icon === 'shield') {
      return '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
    }
    if (icon === 'car') {
      return '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 1 0 4 0M5 17a2 2 0 1 1 4 0m6 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0M3 17V11l2-5h14l2 5v6"></path></svg>';
    }
    return '';
  }

  function handlePresetClick(amt: number): void {
    selectedPreset = amt;
    customAmountInput = '';
    vibrate(6);
    if (checkout.order) {
      checkout.order.base_amount = amt;
      checkout.order.total_amount = amt;
    }
  }

  function handleCustomInput(e: Event): void {
    selectedPreset = null;
    const val = parseFloat((e.target as HTMLInputElement).value) || 0;
    if (checkout.order) {
      checkout.order.base_amount = val;
      checkout.order.total_amount = val;
    }
  }

  function handleCopyRevtag(): void {
    if (!profile?.handle) return;
    vibrate(10);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(profile.handle).catch(() => {});
    }
    checkout.showToast(`Хендл ${profile.handle} скопійовано`);
  }

  function handleShareProfile(): void {
    vibrate(8);
    const title = profile?.name || 'Профіль';
    const text = 'Зручно платити та замовляти через Rahunok';
    const url = typeof window !== 'undefined' ? window.location.href : '';

    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => checkout.showToast('Посилання скопійовано'));
    } else {
      navigator.clipboard?.writeText(url);
      checkout.showToast('Посилання скопійовано');
    }
  }

  function handlePay(): void {
    if (checkout.totalAmount > 0) {
      checkout.openPaymentSheet();
    }
  }

  function handleBack(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  }

  const payVerb = $derived(profile?.type === 'person' ? 'Переказати' : 'Сплатити');
</script>

<div class="screen-content">
  <nav class="order-nav">
    <button class="order-nav-btn back-btn" onclick={handleBack} aria-label="Назад">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    <div class="order-merchant">
      <div class="merchant-avatar" style="background: {profile?.avatar?.bg || 'var(--order-surface)'};">
        {#if profile?.avatar?.type === 'image'}
          <img src={profile.avatar.val} alt="" />
        {:else}
          {profile?.avatar?.val || 'Р'}
        {/if}
      </div>
      <span class="order-merchant-name">{profile?.name || checkout.merchantName}</span>
    </div>
    <button class="order-nav-btn more-btn" onclick={() => checkout.openActionSheet()} aria-label="Дії">
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="19" cy="12" r="1"></circle>
        <circle cx="5" cy="12" r="1"></circle>
      </svg>
    </button>
  </nav>

  <header class="profile-header">
    <div class="profile-avatar" style="background: {profile?.avatar?.bg || 'var(--order-surface)'};">
      {#if profile?.avatar?.type === 'image'}
        <img src={profile.avatar.val} alt="" />
      {:else}
        {profile?.avatar?.val || 'К'}
      {/if}
    </div>

    <div class="profile-name-group">
      <h1 class="profile-name">{profile?.name || 'Профіль'}</h1>
      {#if profile?.verified !== false}
        <svg class="verified-badge" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      {/if}
    </div>

    <p class="profile-desc">{profile?.description || ''}</p>

    {#if profile?.handle}
      <button class="revtag-pill" onclick={handleCopyRevtag} aria-label="Скопіювати платіжний хендл">
        <span class="rt-icon">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
        <span>{profile.handle}</span>
        <span class="rt-copy">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </span>
      </button>
    {/if}

    <div class="profile-meta">
      {#each profile?.metaItems || [] as meta}
        <span class="meta-item">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html getMetaIconSvg(meta.icon)}
          <span>{meta.text}</span>
        </span>
      {/each}
    </div>
  </header>

  <!-- Блок 1: Швидка оплата / переказ -->
  {#if profile?.quickPay?.enabled !== false}
    <section class="profile-section">
      <h2 class="section-title">{profile?.quickPay?.label || 'Сплатити довільну суму'}</h2>
      <div class="quick-pay-presets">
        {#each profile?.quickPay?.presets || [100, 200, 500] as amt}
          <button
            class="qp-preset"
            class:selected={selectedPreset === amt}
            onclick={() => handlePresetClick(amt)}
          >
            {amt} ₴
          </button>
        {/each}
      </div>

      <div class="qp-custom-wrap">
        <input
          type="number"
          class="qp-custom-input"
          placeholder="Інша сума"
          bind:value={customAmountInput}
          oninput={handleCustomInput}
        />
        <span class="qp-currency">₴</span>
      </div>

      <button
        class="order-cta"
        disabled={checkout.totalAmount <= 0}
        onclick={handlePay}
      >
        {checkout.totalAmount > 0 ? `${payVerb} ${checkout.totalAmount} ₴` : 'Введіть суму'}
      </button>
    </section>
  {/if}

  <!-- Блок 2: Товари / Меню (опціонально для бізнесів) -->
  {#if profile?.products && profile.products.length > 0}
    <section class="profile-section">
      <h2 class="section-title">Популярне</h2>
      <div class="mini-catalog">
        {#each profile.products as prod}
          <div
            class="product-card"
            role="button"
            tabindex="0"
            onclick={() => handlePresetClick(prod.price)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handlePresetClick(prod.price);
            }}
          >
            <img class="pc-img" src={prod.image} alt={prod.name} loading="lazy" />
            <div class="pc-info">
              <div class="pc-name">{prod.name}</div>
              <div class="pc-price">{prod.price} ₴</div>
            </div>
          </div>
        {/each}
      </div>
      <button
        class="order-cta"
        style="background:var(--order-surface-2); color:var(--order-text); margin-top:8px;"
        onclick={() => checkout.showToast('Меню відкривається')}
      >
        Переглянути меню
      </button>
    </section>
  {/if}

  <!-- Блок 3: Контакти / соцмережі -->
  {#if profile?.links && profile.links.length > 0}
    <section class="profile-section">
      <h2 class="section-title">{profile.linksTitle || 'Зв’язатися'}</h2>
      <div class="links-list">
        {#each profile.links as link}
          <a
            href={link.href || '#'}
            target={link.href ? '_blank' : undefined}
            rel="noopener noreferrer"
            class="profile-link"
          >
            {#if link.badge}
              <span
                class="pl-icon pl-badge"
                style="background:{link.badge.bg}; color:{link.badge.color};"
              >
                {link.badge.text}
              </span>
            {:else if link.icon}
              <span class="pl-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d={link.icon}></path>
                </svg>
              </span>
            {/if}
            <span class="pl-text">
              <span class="pl-label">{link.label}</span>
              {#if link.sub}
                <span class="pl-sub">{link.sub}</span>
              {/if}
            </span>
            <svg
              class="pl-chevron"
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
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Блок 4: Довіра -->
  {#if profile?.trust}
    <section class="trust-card">
      <div class="tc-title">
        {profile.type === 'person' ? 'Чому цьому профілю можна довіряти' : 'Перевірений бізнес-профіль'}
      </div>
      <div id="trustRows">
        {#each profile.trust.rows || [] as row}
          <div class="tc-row">
            <svg class="tc-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{row}</span>
          </div>
        {/each}
      </div>
      <div class="tc-footer">{profile.trust.footer || ''}</div>
    </section>
  {/if}

  <div style="text-align: center;">
    <button class="share-profile-btn" onclick={handleShareProfile}>
      <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
      Поділитися профілем
    </button>
  </div>
</div>

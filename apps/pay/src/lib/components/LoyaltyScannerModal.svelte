<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { checkout, formatNumber, vibrate } from '../state/checkout.svelte.js';

  let manualInput = $state('');
  let videoEl = $state<HTMLVideoElement | null>(null);
  let mediaStream = $state<MediaStream | null>(null);
  let cameraActive = $state(false);
  let cameraError = $state<string | null>(null);
  let torchActive = $state(false);
  let isScanning = $state(true);

  async function startCamera(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      cameraError = 'Камера недоступна в цьому браузері';
      return;
    }
    try {
      cameraError = null;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      mediaStream = stream;
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', 'true');
        await videoEl.play();
      }
      cameraActive = true;
    } catch {
      cameraActive = false;
      cameraError = 'Доступ до камери не надано або камера відсутня';
    }
  }

  function stopCamera(): void {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStream = null;
    }
    cameraActive = false;
    torchActive = false;
  }

  async function toggleTorch(): Promise<void> {
    if (!mediaStream) {
      torchActive = !torchActive;
      vibrate(8);
      return;
    }
    const track = mediaStream.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
        if (capabilities?.torch) {
          torchActive = !torchActive;
          await track.applyConstraints({
            advanced: [{ torch: torchActive }] as unknown as MediaTrackConstraintSet[]
          });
          vibrate(8);
          return;
        }

      } catch {
        // ignore
      }
    }
    torchActive = !torchActive;
    vibrate(8);
  }

  function handleManualApply(): void {
    if (!manualInput.trim()) return;
    const ok = checkout.applyLoyaltyCard(manualInput.trim());
    if (ok) {
      manualInput = '';
    }
  }

  function handleQuickScan(code: string): void {
    vibrate([25, 40, 25]);
    checkout.applyLoyaltyCard(code);
  }

  function handleClose(): void {
    stopCamera();
    checkout.closeLoyaltyScanner();
  }

  onMount(() => {
    startCamera();
  });

  onDestroy(() => {
    stopCamera();
  });
</script>

<div
  class="action-sheet-backdrop loyalty-modal-backdrop"
  class:visible={checkout.isLoyaltyScannerOpen}
  onclick={handleClose}
  role="presentation"
>
  <div
    class="loyalty-modal-sheet"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="loyalty-modal-title"
    tabindex="-1"
  >
    <!-- Grab handle for mobile touch feel -->
    <div class="sheet-handle-bar">
      <div class="sheet-handle"></div>
    </div>

    <!-- Header -->
    <header class="loyalty-modal-header">
      <div class="header-titles">
        <div class="header-pre">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Захищена ідентифікація</span>
        </div>
        <h2 id="loyalty-modal-title" class="header-title">Картка лояльності</h2>
      </div>

      <button class="glass-close-btn" onclick={handleClose} aria-label="Закрити">
        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </header>

    <div class="loyalty-modal-content">
      {#if !checkout.loyaltyCard}
        <!-- Scanner Viewfinder Section -->
        <section class="scanner-section">
          <div class="scanner-viewport" class:torch-on={torchActive}>
            <!-- Video background if stream active -->
            <video
              bind:this={videoEl}
              class="scanner-video"
              class:visible={cameraActive}
              autoplay
              playsinline
              muted
            ></video>

            <!-- Tech Reticle Overlay -->
            <div class="scanner-reticle">
              <div class="reticle-corner tl"></div>
              <div class="reticle-corner tr"></div>
              <div class="reticle-corner bl"></div>
              <div class="reticle-corner br"></div>

              <!-- Animated Laser Scanning Beam -->
              {#if isScanning}
                <div class="scanner-laser"></div>
              {/if}

              <div class="reticle-hint">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                  <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                  <line x1="7" y1="12" x2="17" y2="12"></line>
                </svg>
                <span>Наведіть на штрих-код або QR</span>
              </div>
            </div>

            <!-- Viewfinder Toolbar -->
            <div class="scanner-toolbar">
              <button
                type="button"
                class="scanner-tool-btn"
                class:active={torchActive}
                onclick={toggleTorch}
                title="Ліхтарик"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill={torchActive ? 'currentColor' : 'none'}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>{torchActive ? 'Світло увімк.' : 'Підсвітка'}</span>
              </button>

              <button
                type="button"
                class="scanner-tool-btn scan-trigger"
                onclick={() => handleQuickScan('ROZ-889922')}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Розпізнати тестову</span>
              </button>
            </div>
          </div>

          <!-- Quick Test Presets -->
          <div class="presets-section">
            <span class="presets-label">Швидкий вибір картки для тесту:</span>
            <div class="presets-scroll">
              <button
                type="button"
                class="preset-chip rozetka"
                onclick={() => handleQuickScan('ROZ-889922')}
              >
                <span class="chip-dot rozetka"></span>
                <span class="chip-name">Rozetka Club VIP</span>
                <span class="chip-bonus">150 ₴</span>
              </button>
              <button
                type="button"
                class="preset-chip silpo"
                onclick={() => handleQuickScan('2900012345678')}
              >
                <span class="chip-dot silpo"></span>
                <span class="chip-name">Сільпо Власний Рахунок</span>
                <span class="chip-bonus">85 ₴</span>
              </button>
              <button
                type="button"
                class="preset-chip fishka"
                onclick={() => handleQuickScan('9900012345678')}
              >
                <span class="chip-dot fishka"></span>
                <span class="chip-name">OKKO Fishka</span>
                <span class="chip-bonus">220 ₴</span>
              </button>
            </div>
          </div>
        </section>

        <!-- Manual Entry Section -->
        <section class="manual-section">
          <label for="loyalty-identifier" class="manual-label">
            Або введіть номер картки чи телефон:
          </label>
          <div class="manual-input-box">
            <div class="input-icon">
              <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
            <input
              id="loyalty-identifier"
              type="text"
              class="manual-input"
              placeholder="9900 •••• •••• або +380"
              bind:value={manualInput}
              onkeydown={(e) => {
                if (e.key === 'Enter') handleManualApply();
              }}
            />
            {#if manualInput}
              <button
                type="button"
                class="input-clear-btn"
                onclick={() => (manualInput = '')}
                aria-label="Очистити"
              >
                ✕
              </button>
            {/if}
            <button
              type="button"
              class="manual-apply-btn"
              disabled={!manualInput.trim()}
              onclick={handleManualApply}
            >
              Застосувати
            </button>
          </div>
        </section>
      {:else}
        <!-- Active Recognized Loyalty Pass View (Apple Wallet Card Pass) -->
        <section class="active-card-section">
          <div
            class="apple-pass-card"
            style="--pass-gradient: {checkout.loyaltyCard.badge_color || 'linear-gradient(135deg, #1c1c1e, #2c2c2e)'};"
          >
            <div class="pass-glare"></div>
            <div class="pass-top">
              <div class="pass-brand">
                <div class="pass-chip-icon">
                  <svg viewBox="0 0 32 24" width="32" height="24" fill="none">
                    <rect width="32" height="24" rx="4" fill="url(#chipGrad)" />
                    <path d="M0 8h10M0 16h10M22 8h10M22 16h10M10 0v24M22 0v24" stroke="rgba(0,0,0,0.32)" stroke-width="1"/>
                    <rect x="10" y="7" width="12" height="10" rx="2" fill="none" stroke="rgba(0,0,0,0.32)" stroke-width="1"/>
                    <defs>
                      <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ffe259"/>
                        <stop offset="100%" stop-color="#ffa751"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="pass-title">{checkout.loyaltyCard.program_name}</div>
              </div>
              <div class="pass-tier-badge">{checkout.loyaltyCard.tier}</div>
            </div>

            <div class="pass-middle">
              <div class="pass-balance-label">Доступні бонуси</div>
              <div class="pass-balance-value">
                {formatNumber(checkout.loyaltyCard.bonus_balance)}
                <span class="pass-currency-sym">₴</span>
              </div>
            </div>

            <div class="pass-bottom">
              <div class="pass-holder">
                <span class="pass-sub">Власник</span>
                <span class="pass-name">{checkout.loyaltyCard.holder_name}</span>
              </div>
              <div class="pass-number">
                <span class="pass-sub">Номер</span>
                <span class="pass-num-val">{checkout.loyaltyCard.card_number}</span>
              </div>
            </div>

            <!-- Optical Vector Barcode Graphic -->
            <div class="pass-barcode-lines">
              <svg viewBox="0 0 300 24" width="100%" height="24" fill="currentColor" opacity="0.65" preserveAspectRatio="none">
                <rect x="0" width="3" height="24"/><rect x="6" width="2" height="24"/><rect x="11" width="5" height="24"/>
                <rect x="19" width="1" height="24"/><rect x="23" width="3" height="24"/><rect x="29" width="2" height="24"/>
                <rect x="34" width="4" height="24"/><rect x="41" width="2" height="24"/><rect x="46" width="1" height="24"/>
                <rect x="50" width="5" height="24"/><rect x="58" width="2" height="24"/><rect x="63" width="3" height="24"/>
                <rect x="69" width="1" height="24"/><rect x="73" width="4" height="24"/><rect x="80" width="2" height="24"/>
                <rect x="85" width="3" height="24"/><rect x="91" width="5" height="24"/><rect x="99" width="1" height="24"/>
                <rect x="103" width="3" height="24"/><rect x="109" width="2" height="24"/><rect x="114" width="4" height="24"/>
                <rect x="121" width="2" height="24"/><rect x="126" width="3" height="24"/><rect x="132" width="5" height="24"/>
                <rect x="140" width="2" height="24"/><rect x="145" width="1" height="24"/><rect x="149" width="4" height="24"/>
                <rect x="156" width="2" height="24"/><rect x="161" width="3" height="24"/><rect x="167" width="1" height="24"/>
                <rect x="171" width="4" height="24"/><rect x="178" width="2" height="24"/><rect x="183" width="3" height="24"/>
                <rect x="189" width="5" height="24"/><rect x="197" width="2" height="24"/><rect x="202" width="1" height="24"/>
                <rect x="206" width="4" height="24"/><rect x="213" width="2" height="24"/><rect x="218" width="3" height="24"/>
                <rect x="224" width="1" height="24"/><rect x="228" width="4" height="24"/><rect x="235" width="2" height="24"/>
                <rect x="240" width="5" height="24"/><rect x="248" width="3" height="24"/><rect x="254" width="1" height="24"/>
                <rect x="258" width="4" height="24"/><rect x="265" width="2" height="24"/><rect x="270" width="3" height="24"/>
                <rect x="276" width="2" height="24"/><rect x="281" width="4" height="24"/><rect x="288" width="2" height="24"/>
                <rect x="293" width="3" height="24"/><rect x="298" width="2" height="24"/>
              </svg>
            </div>
          </div>


          <!-- Controls & Bonus Deduct Toggle -->
          <div class="pass-actions-card">
            <button
              type="button"
              class="bonus-toggle-row"
              onclick={() => checkout.toggleLoyaltyBonusUsage()}
            >
              <div class="toggle-text-col">
                <div class="toggle-title">
                  {checkout.loyaltyCard.use_bonuses
                    ? `Списати ${formatNumber(checkout.loyaltyCard.bonus_balance)} ₴ бонусів`
                    : 'Накопичувати кешбек'}
                </div>
                <div class="toggle-sub">
                  {checkout.loyaltyCard.use_bonuses
                    ? 'Сума до сплати зменшиться автоматично'
                    : '+5% повернеться бонусами після оплати'}
                </div>
              </div>
              <div class="apple-switch" class:active={checkout.loyaltyCard.use_bonuses}>
                <span class="switch-knob"></span>
              </div>
            </button>

            <div class="pass-card-footer">
              <button
                type="button"
                class="detach-card-btn"
                onclick={() => checkout.removeLoyaltyCard()}
              >
                Відʼєднати картку
              </button>
              <button
                type="button"
                class="pass-done-btn"
                onclick={handleClose}
              >
                Готово
              </button>
            </div>
          </div>
        </section>
      {/if}
    </div>
  </div>
</div>

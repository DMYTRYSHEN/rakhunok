<script lang="ts">
  import { checkout, vibrate } from '../state/checkout.svelte.js';

  const tracking = $derived.by(() => {
    return (
      checkout.order?.np_tracking || {
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
      }
    );
  });

  function copyTtn(): void {
    vibrate(10);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tracking.ttn);
      checkout.showToast(`ТТН ${tracking.ttn} скопійовано`);
    }
  }

  function openNpApp(): void {
    vibrate(8);
    const url = `https://tracking.novaposhta.ua/#/uk/${tracking.ttn}`;
    window.open(url, '_blank');
  }
</script>

{#if checkout.isNpTrackingOpen}
  <div
    class="action-sheet-backdrop visible"
    onclick={() => checkout.closeNpTracking()}
    role="presentation"
  ></div>

  <div class="fiscal-modal" role="dialog">
    <div class="np-tracking-card">
      <div class="np-header">
        <div class="np-brand">
          <div class="np-logo-box">НП</div>
          <div>
            <div class="np-brand-name">Нова пошта</div>
            <div class="np-status-tag">{tracking.status_title}</div>
          </div>
        </div>
        <button class="np-close-icon" onclick={() => checkout.closeNpTracking()} aria-label="Закрити">
          ✕
        </button>
      </div>

      <!-- TTN Bar -->
      <div class="np-ttn-bar">
        <div>
          <div class="np-ttn-label">Номер накладної (ТТН):</div>
          <div class="np-ttn-num">{tracking.ttn}</div>
        </div>
        <button class="np-copy-btn" onclick={copyTtn}>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Скопіювати</span>
        </button>
      </div>

      <!-- Route & Delivery Date -->
      <div class="np-route-box">
        <div class="np-route-cities">
          <span class="np-city">{tracking.sender_city}</span>
          <span class="np-arrow">→</span>
          <span class="np-city dest">{tracking.recipient_city}</span>
        </div>
        <div class="np-dest-branch">{tracking.recipient_branch}</div>
        <div class="np-eta-row">
          <span class="np-eta-label">Орієнтовна доставка:</span>
          <span class="np-eta-val">{tracking.estimated_delivery}</span>
        </div>
      </div>

      <!-- Timeline Steps -->
      <div class="np-timeline">
        {#each tracking.steps as step, idx}
          <div class="np-timeline-step" class:done={step.done} class:active={step.active}>
            <div class="np-step-marker">
              {#if step.done && !step.active}
                ✓
              {:else if step.active}
                ●
              {:else}
                ○
              {/if}
            </div>
            <div class="np-step-content">
              <div class="np-step-title">{step.title}</div>
              <div class="np-step-time">{step.time}</div>
            </div>
          </div>
        {/each}
      </div>

      <div class="np-actions">
        <button class="np-app-btn" onclick={openNpApp}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2zm0-10h2v8h-2z"></path>
          </svg>
          <span>Відстежити на сайті Нової пошти</span>
        </button>

        <button class="status-btn-secondary" onclick={() => checkout.closeNpTracking()}>
          Закрити
        </button>
      </div>
    </div>
  </div>
{/if}

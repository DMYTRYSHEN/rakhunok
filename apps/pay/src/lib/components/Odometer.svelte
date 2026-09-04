<script lang="ts">
  let {
    value = '',
    suffix = '',
    suffixClass = '',
    class: customClass = ''
  }: {
    value: string | number;
    suffix?: string;
    suffixClass?: string;
    class?: string;
  } = $props();

  let containerEl: HTMLElement | null = $state(null);
  let prevStr = '';

  $effect(() => {
    if (!containerEl) return;
    const str = String(value ?? '');
    const fullKey = `${str}|${suffix}`;

    // Rebuild columns only if length/structure changes or on value update
    containerEl.innerHTML = '';
    const chars = [...str];

    chars.forEach((ch, i) => {
      if (/\d/.test(ch)) {
        const shaft = document.createElement('span');
        shaft.className = 'd-shaft';
        const col = document.createElement('span');
        col.className = 'd-col';
        for (let d = 0; d <= 9; d++) {
          const s = document.createElement('span');
          s.textContent = String(d);
          col.appendChild(s);
        }
        shaft.appendChild(col);
        containerEl?.appendChild(shaft);

        const prevCh = prevStr[i];
        const startDigit = /\d/.test(prevCh || '') ? parseInt(prevCh, 10) : 0;
        const target = parseInt(ch, 10);
        col.style.transition = 'none';
        col.style.transform = `translateY(${-startDigit}em)`;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            col.style.transition = '';
            col.style.transform = `translateY(${-target}em)`;
          });
        });
      } else {
        const s = document.createElement('span');
        s.textContent = ch === ' ' ? '\u00A0' : ch;
        containerEl?.appendChild(s);
      }
    });

    if (suffix) {
      const s = document.createElement('span');
      if (suffixClass) s.className = suffixClass;
      s.textContent = suffix;
      containerEl.appendChild(s);
    }

    prevStr = str;
  });
</script>

<div bind:this={containerEl} class="anim-amount {customClass}"></div>

<style>
  .anim-amount {
    display: inline-flex;
    align-items: baseline;
    font-feature-settings: "tnum" 1;
  }
  :global(.anim-amount .d-shaft) {
    display: inline-block;
    height: 1em;
    overflow: hidden;
    line-height: 1;
  }
  :global(.anim-amount .d-col) {
    display: flex;
    flex-direction: column;
    transition: transform 0.6s var(--ease-spring, cubic-bezier(0.175, 0.885, 0.32, 1.15));
    will-change: transform;
  }
  :global(.anim-amount .d-col span) {
    height: 1em;
    line-height: 1;
    display: block;
  }
  :global(.anim-amount > span:not(.d-shaft)) {
    line-height: 1;
  }
</style>

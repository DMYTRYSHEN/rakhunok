// =========================================================
// Odometer Digits Animation
// =========================================================

export function setAnimatedAmount(el, str, suffix, suffixClass) {
  const key = str + '|' + (suffix || '');
  if (el._key === key) return;
  const prev = el._str || '';
  el._key = key;
  el._str = str;
  el.classList.add('anim-amount');
  el.innerHTML = '';

  [...str].forEach((ch, i) => {
    if (/\d/.test(ch)) {
      const shaft = document.createElement('span');
      shaft.className = 'd-shaft';
      const col = document.createElement('span');
      col.className = 'd-col';
      for (let d = 0; d <= 9; d++) {
        const s = document.createElement('span');
        s.textContent = d;
        col.appendChild(s);
      }
      shaft.appendChild(col);
      el.appendChild(shaft);

      const prevCh = prev[i];
      const startDigit = /\d/.test(prevCh || '') ? parseInt(prevCh, 10) : 0;
      const target = parseInt(ch, 10);
      col.style.transition = 'none';
      col.style.transform = `translateY(${-startDigit}em)`;

      if (startDigit !== target) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            col.style.transition = '';
            col.style.transform = `translateY(${-target}em)`;
          })
        );
      }
    } else {
      const s = document.createElement('span');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      el.appendChild(s);
    }
  });

  if (suffix) {
    const s = document.createElement('span');
    if (suffixClass) s.className = suffixClass;
    s.textContent = suffix;
    el.appendChild(s);
  }
}

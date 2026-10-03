import QRCode from 'qrcode'
import { generateNbuPayload, validateNbuInput, type NbuFormInput } from './nbu.ts'
import './style.css'
import { mountBankDemo } from './bank-demo.ts'
import { mountRahunokAssistant } from './rahunok-assistant.ts'

type Tone = 'ink' | 'red' | 'blue'
type LineStyle = 'horizontal' | 'vertical' | 'mixed' | 'demo' | 'dots'
type PositioningType = 'rounded' | 'circle' | 'square'
type CorrectionLevel = 'L' | 'M' | 'Q' | 'H'
type LogoMode = 'rahunok' | 'none' | 'custom'
type QrModules = { size: number; data: Uint8Array }

const palette: Record<Tone, string> = {
  ink: '#111111',
  red: '#f04424',
  blue: '#1747d1',
}
const qrApiBase = import.meta.env.DEV ? 'http://127.0.0.1:8789' : 'https://api.a2qr.dev'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <a class="skip-link" href="#generator-form">До генератора QR</a>
  <header class="site-header">
    <a class="brand" href="#top" aria-label="A2 QR, на початок">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
      <span>A2 / QR</span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
      <span class="menu-toggle-label">Меню</span>
      <span class="menu-toggle-icon" aria-hidden="true"><i></i><i></i></span>
    </button>
    <nav id="site-nav" aria-label="Головна навігація">
      <p class="mobile-nav-index">A2 / НАВІГАЦІЯ</p>
      <a href="#payment-qr">QR НБУ</a>
      <a href="#how-to-pay">Як створити</a>
      <a href="#qr-acquiring">QR-еквайринг</a>
      <a href="#faq">Питання</a>
      <a class="nav-cta" href="#payment-qr">Створити QR НБУ <span aria-hidden="true">↘</span></a>
      <p class="mobile-nav-foot">IBAN → QR → ОПЛАТА</p>
    </nav>
  </header>

  <main id="top">
    <section class="hero hero--with-assistant" id="studio">
      <canvas id="hero-signal" class="hero-signal" aria-hidden="true"></canvas>
      <div class="hero-copy">
        <p class="eyebrow"><span>01</span> ПОСИЛАННЯ · РАХУНОК · ОДИН СКАН</p>
        <h1>A2<span class="hero-slash">/</span><span id="title-qr" class="title-qr" aria-hidden="true"></span><span class="hero-title-caption">QR, ЯКИЙ<br /><em>МАЄ ВАШ ЗНАК.</em></span></h1>
        <p class="hero-note">Для меню, паковання та рахунків. Перетворіть посилання на QR із власним характером. Або створіть платіжний QR НБУ за IBAN.</p>
        <a class="hero-payment-link" href="#payment-qr">Створити платіжний QR <span aria-hidden="true">↘</span></a>
      </div>

      <div class="hero-assistant" id="rahunok-assistant"></div>

      <div class="qr-stage" aria-live="polite">
        <div class="orbit-label orbit-label--top">A2 / ВІДБИТОК ПОСИЛАННЯ</div>
        <div class="qr-pair">
          <article class="qr-option">
            <div class="qr-paper">
              <div id="qr-preview" class="qr-preview" role="img" aria-label="Попередній перегляд QR-коду A2"></div>
              <span class="crop crop--tl"></span><span class="crop crop--tr"></span>
              <span class="crop crop--bl"></span><span class="crop crop--br"></span>
            </div>
            <p><span>01 / ОРИГІНАЛ</span><span>SVG</span></p>
          </article>
          <article class="qr-option">
            <div class="qr-paper qr-paper--logo">
              <div id="qr-logo-preview" class="qr-preview" role="img" aria-label="QR-код A2 з логотипом Rahunok по центру"></div>
            </div>
            <p><span>02 / ВАШ ЗНАК</span><span>SVG</span></p>
          </article>
        </div>
        <div class="orbit-label orbit-label--bottom">ПОСИЛАННЯ → ФОРМА → СКАН</div>
      </div>

      <form class="generator" id="generator-form">
        <label for="qr-data">Майстерня / Ваше посилання</label>
        <div class="url-control">
          <input id="qr-data" name="data" type="url" value="https://rakhunok.com/pay/demo" required spellcheck="false" />
          <button type="submit" aria-label="Згенерувати QR">↗</button>
        </div>
        <div class="control-row">
          <fieldset>
            <legend>Колір</legend>
            <div class="swatches">
              <button class="swatch is-active" type="button" data-tone="ink" aria-label="Чорний" title="Чорний"></button>
              <button class="swatch swatch--red" type="button" data-tone="red" aria-label="Червоний" title="Червоний"></button>
              <button class="swatch swatch--blue" type="button" data-tone="blue" aria-label="Синій" title="Синій"></button>
            </div>
          </fieldset>
          <fieldset class="density-control">
            <legend>Щільність ліній</legend>
            <input id="density" type="range" min="42" max="76" value="60" aria-label="Щільність ліній" />
          </fieldset>
          <fieldset class="line-style-control">
            <legend>Напрям ліній</legend>
            <div class="line-style-options" role="group" aria-label="Напрям ліній QR-коду">
              <button class="is-active" type="button" data-line-style="horizontal" aria-label="Горизонтальні лінії" title="Горизонтальні лінії"><span aria-hidden="true">≡</span></button>
              <button type="button" data-line-style="vertical" aria-label="Вертикальні лінії" title="Вертикальні лінії"><span aria-hidden="true">|||</span></button>
              <button type="button" data-line-style="mixed" aria-label="Горизонтальні та вертикальні лінії" title="Мікс: горизонтальні та вертикальні"><span aria-hidden="true">⌗</span></button>
              <button type="button" data-line-style="demo" aria-label="Мікс" title="Мікс"><span aria-hidden="true">▦</span></button>
              <button type="button" data-line-style="dots" aria-label="Круглі крапки" title="Круглі крапки"><span aria-hidden="true">●</span></button>
            </div>
          </fieldset>
          <fieldset class="logo-control">
            <legend>Лого</legend>
            <div class="logo-options" role="group" aria-label="Логотип у QR-коді">
              <button class="is-active" type="button" data-logo-mode="rahunok">R</button>
              <button type="button" data-logo-mode="none">Без</button>
              <label class="logo-upload" title="Завантажити власний SVG або PNG">
                <input id="custom-logo" type="file" accept="image/svg+xml,image/png" />
                <span>Своє</span>
              </label>
            </div>
          </fieldset>
        </div>
        <div class="style-settings">
          <label>Рівень корекції<select id="correction-level"><option value="L">7%</option><option value="M">15%</option><option value="Q">25%</option><option value="H" selected>30%</option></select></label>
          <label>Форма маркерів<select id="positioning-type"><option value="rounded" selected>Заокруглений квадрат</option><option value="circle">Коло</option><option value="square">Квадрат</option></select></label>
          <label>Масштаб вмісту<input id="content-scale" type="range" min="0.5" max="1" step="0.05" value="0.6" /><output for="content-scale" id="content-scale-value">0.6</output></label>
        </div>
        <div class="actions">
          <button class="action-primary" id="download" type="button">Завантажити SVG <span aria-hidden="true">↓</span></button>
          <button class="action-secondary" id="download-logo" type="button">SVG з логотипом <span aria-hidden="true">↓</span></button>
          <button class="action-secondary" id="copy-url" type="button">Копіювати API</button>
          <p class="status" id="status" role="status">QR сформовано</p>
        </div>
      </form>
    </section>

    <section class="ticker" aria-label="Можливості">
      <div><span>НЕ КОПІЮВАТИ.</span> <i>→</i> <span>СКАНУВАТИ.</span> <small>ВІД ПОСИЛАННЯ ДО ДІЇ</small></div>
    </section>

    <section class="payment-builder" id="payment-qr" aria-labelledby="payment-title">
      <div class="payment-story scroll-reveal">
        <p class="section-index">02 / СТВОРИТИ QR НБУ ОНЛАЙН</p>
        <h2 id="payment-title">IBAN<br /><em>ОПЛАТА</em><br />В QR<span>.</span></h2>
        <p class="payment-intro">Заповніть реквізити й створіть QR НБУ для оплати за IBAN. Надішліть код клієнту або додайте його до рахунку: після сканування відкриється сумісний банківський застосунок із підготовленим платежем.</p>
        <p class="payment-privacy"><span aria-hidden="true"></span> Перевірка реквізитів відбувається у браузері. Для створення зображення закодоване посилання з реквізитами передається до A2 QR API.</p>
        <p class="payment-disclaimer">QR передає платіжну інструкцію. Він не підтверджує виконання чи зарахування платежу.</p>
      </div>

      <div class="payment-tool scroll-reveal" id="payment-tool">
        <form class="nbu-form" id="nbu-form" novalidate>
          <div class="nbu-form-heading">
            <h3>Реквізити переказу</h3>
          </div>
          <label class="nbu-field" for="nbu-recipient">
            <span class="nbu-field-head"><span>Отримувач</span><span><b data-count-for="nbu-recipient">0</b> / 70</span></span>
            <input id="nbu-recipient" name="recipientName" type="text" maxlength="70" autocomplete="organization" placeholder="Ім’я або назва отримувача" required />
          </label>
          <label class="nbu-field" for="nbu-tax-id">
            <span class="nbu-field-head"><span>ЄДРПОУ / РНОКПП</span><span><b data-count-for="nbu-tax-id">0</b> / 10</span></span>
            <input id="nbu-tax-id" name="recipientTaxId" type="text" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="8 або 10 цифр" required />
          </label>
          <label class="nbu-field" for="nbu-iban">
            <span class="nbu-field-head"><span>IBAN</span><span><b data-count-for="nbu-iban">0</b> / 29</span></span>
            <input id="nbu-iban" name="recipientIban" type="text" inputmode="text" maxlength="34" autocomplete="off" autocapitalize="characters" placeholder="UA00 0000 0000 0000 0000 0000 0000" required />
          </label>
          <label class="nbu-field" for="nbu-amount">
            <span class="nbu-field-head"><span>Сума переказу</span><span class="nbu-optional">НЕОБОВ’ЯЗКОВО</span></span>
            <input id="nbu-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="Не заповнюйте, якщо суму введе клієнт" />
          </label>
          <label class="nbu-field" for="nbu-purpose">
            <span class="nbu-field-head"><span>Призначення платежу</span><span><b data-count-for="nbu-purpose">0</b> / 140</span></span>
            <input id="nbu-purpose" name="purpose" type="text" maxlength="140" autocomplete="off" placeholder="Наприклад: Оплата рахунку 24" required />
          </label>
          <label class="nbu-consent" for="nbu-consent">
            <input id="nbu-consent" name="consent" type="checkbox" required />
            <span>Погоджуюсь на обробку реквізитів у браузері та передачу закодованого платіжного посилання до A2 QR API для створення зображення.</span>
          </label>
          <button class="nbu-submit" type="submit">ЗГЕНЕРУВАТИ QR-КОД <span aria-hidden="true">↗</span></button>
          <p class="nbu-form-status" id="nbu-form-status" role="status" aria-live="polite">Поля з реквізитами перевіряються перед генерацією.</p>
        </form>
      </div>

      <aside class="payment-journey scroll-reveal" id="payment-journey" aria-label="QR і шлях платежу">
        <div class="nbu-result" id="nbu-result" aria-label="Згенерований платіжний QR">
          <div class="nbu-result-head"><span id="nbu-result-state">ДЕМО · НЕ ДЛЯ ОПЛАТИ</span></div>
          <div class="nbu-qr" id="nbu-qr"></div>
          <p class="nbu-result-summary" id="nbu-result-summary"></p>
          <div class="nbu-result-actions">
            <button id="nbu-download-svg" type="button" disabled>Завантажити SVG <span aria-hidden="true">↓</span></button>
            <button id="nbu-download" type="button" disabled>Завантажити PNG <span aria-hidden="true">↓</span></button>
            <button id="nbu-copy" type="button" disabled>Копіювати URL</button>
          </div>
        </div>
      </aside>
    </section>

    <section class="search-guide motion-section" id="how-to-pay" aria-labelledby="guide-title">
      <div class="search-guide-head motion-title">
        <p class="section-index">03 / ЯК СТВОРИТИ ПЛАТІЖНИЙ QR</p>
        <h2 id="guide-title">ВІД IBAN<br />ДО ОПЛАТИ<br /><em>ЗА ТРИ КРОКИ.</em></h2>
        <p>Платіжний QR прибирає ручне копіювання довгого номера рахунку. Дані вже підготовлені, але остаточне рішення та підтвердження завжди залишаються за платником.</p>
      </div>
      <ol class="seo-steps">
        <li class="motion-item"><b>01</b><h3>Додайте реквізити</h3><p>Вкажіть назву отримувача, ЄДРПОУ або РНОКПП, український IBAN і призначення платежу. Суму можна зафіксувати або залишити на вибір клієнта.</p></li>
        <li class="motion-item"><b>02</b><h3>Створіть QR НБУ</h3><p>Генератор перевірить поля та сформує платіжне посилання у форматі НБУ. Реквізити обробляються локально у вашому браузері.</p></li>
        <li class="motion-item"><b>03</b><h3>Передайте клієнту</h3><p>Завантажте QR-код для рахунку, повідомлення, екрана чи друку. Перед оплатою клієнт бачить реквізити у банківському застосунку та підтверджує їх.</p></li>
      </ol>
    </section>

    <section class="acquiring-explainer motion-section" id="qr-acquiring" aria-labelledby="acquiring-title">
      <div class="acquiring-title motion-title">
        <p class="section-index">04 / QR-ЕКВАЙРИНГ ЧИ IBAN-ПЕРЕКАЗ</p>
        <h2 id="acquiring-title">ДВА QR.<br /><em>РІЗНІ ЗАДАЧІ.</em></h2>
      </div>
      <div class="payment-comparison">
        <article class="motion-item">
          <p class="comparison-tag">ЦЕЙ СЕРВІС</p>
          <h3>QR НБУ для IBAN-оплати</h3>
          <p>Кодує реквізити банківського переказу. Підходить для рахунків, донатів, послуг і прямих оплат на IBAN. Генератор не приймає кошти та не повідомляє статус платежу.</p>
        </article>
        <article class="motion-item">
          <p class="comparison-tag">ОКРЕМА БАНКІВСЬКА ПОСЛУГА</p>
          <h3>QR-еквайринг</h3>
          <p>Організовує приймання й обробку оплати через банк або платіжного провайдера. Зазвичай потребує договору, має тариф або комісію та повертає бізнесу статус транзакції.</p>
        </article>
      </div>
      <p class="acquiring-note motion-note">Шукаєте QR-еквайринг для каси чи інтернет-магазину? Уточніть у своєму банку підтримку потрібного способу оплати, тарифи, фіскалізацію та інтеграцію зі статусами платежів.</p>
    </section>

    <section class="bank-demo" id="banks" aria-labelledby="banks-title">
      <div class="bank-demo-heading">
        <p class="section-index">БАНКИ / ДЕМОНСТРАЦІЯ</p>
        <h2 id="banks-title">Менше цифр.<br /><em>Ближче до<br />«сплачено».</em></h2>
        <p>Реквізити вже в QR. Залишається перевірити деталі й підтвердити переказ у сумісному банківському застосунку.</p>
      </div>
      <div class="bank-scene" role="img" aria-label="Об’ємний демонстраційний QR-код, не для оплати">
        <canvas id="bank-canvas" aria-hidden="true"></canvas>
        <img class="bank-scene-logo" id="bank-scene-logo" src="${import.meta.env.BASE_URL}banks/privatbank.png" alt="Логотип ПриватБанк" />
        <span class="bank-scene-stamp">A2 / DEMO · НЕ ДЛЯ ОПЛАТИ</span>
      </div>
      <div class="bank-demo-console">
        <div class="bank-explorer-head">
          <p class="section-index" id="bank-count">БАНКИ / ЗАВАНТАЖЕННЯ</p>
          <label class="bank-search">Знайти банк <input id="bank-search" type="search" placeholder="Назва банку" autocomplete="off" /></label>
        </div>
        <div class="bank-carousel">
          <button class="bank-carousel-arrow" id="bank-prev" type="button" aria-label="Попередні банки" title="Попередні банки">←</button>
          <div class="bank-list" id="bank-list" role="group" aria-label="Банк для ілюстрації" aria-live="polite"></div>
          <button class="bank-carousel-arrow" id="bank-next" type="button" aria-label="Наступні банки" title="Наступні банки">→</button>
        </div>
        <p class="bank-list-message" id="bank-list-message" role="status">Завантажуємо перелік банків…</p>
        <div class="bank-demo-detail">
          <p class="section-index" id="bank-demo-name">ПриватБанк / ДЕМО</p>
          <p class="bank-demo-state" id="bank-demo-state" role="status">QR → реквізити → підтвердження</p>
          <button class="bank-play" id="bank-play" type="button">Переглянути демо <span aria-hidden="true">→</span></button>
          <a href="#payment-qr">Створити свій QR <span aria-hidden="true">↗</span></a>
        </div>
        <p class="bank-demo-disclaimer">Ілюстрація загального сценарію, не інтерфейс банку. Перелік не підтверджує партнерство чи підтримку QR НБУ: уточніть її у своєму банку. Демо не відкриває застосунок і не здійснює платіж.</p>
      </div>
    </section>

    <section class="faq-section motion-section" id="faq" aria-labelledby="faq-title">
      <div class="faq-heading motion-title">
        <p class="section-index">05 / ВІДПОВІДІ ПРО QR НБУ</p>
        <h2 id="faq-title">ЧАСТІ<br /><em>ПИТАННЯ.</em></h2>
      </div>
      <div class="faq-list">
        <details class="motion-item" open><summary>Як створити QR НБУ для оплати за IBAN?</summary><p>Заповніть форму вище: отримувач, ЄДРПОУ або РНОКПП, IBAN, сума за потреби та призначення. Після перевірки натисніть «Згенерувати QR-код» і завантажте готове зображення.</p></details>
        <details class="motion-item"><summary>Чи робить QR оплату миттєвою?</summary><p>QR прискорює заповнення реквізитів, але швидкість зарахування залежить від банків платника й отримувача та використаної платіжної інфраструктури. Сам код не гарантує миттєве зарахування коштів.</p></details>
        <details class="motion-item"><summary>Що побачить клієнт після сканування?</summary><p>Сумісний банківський застосунок або офіційну платіжну сторінку з підготовленими реквізитами. Клієнту потрібно перевірити отримувача, IBAN, суму й призначення та самостійно підтвердити платіж.</p></details>
        <details class="motion-item"><summary>Чим QR НБУ відрізняється від QR-еквайрингу?</summary><p>QR НБУ передає інструкцію для переказу за IBAN. QR-еквайринг є послугою приймання платежів через банк або провайдера та може включати комісію, повернення статусу й інтеграцію з касою.</p></details>
        <details class="motion-item"><summary>Куди передаються банківські реквізити?</summary><p>Перевірка й формування платіжного посилання відбуваються у браузері. Посилання містить закодовані, а не зашифровані реквізити й передається до A2 QR API для створення зображення. Не додавайте зайві персональні дані до призначення платежу.</p></details>
      </div>
    </section>

    <section class="manifesto" id="how">
      <p class="section-index">06 / НЕ ЩЕ ОДИН КВАДРАТ</p>
      <div class="manifesto-grid">
        <h2>КОД СТАЄ<br />ЧАСТИНОЮ<br /><span>ДИЗАЙНУ</span></h2>
        <div class="manifesto-copy">
          <p class="lead">Стандартний QR передає дані. A2 робить це виразно: модулі з'єднуються в ритмічні лінії, а службові зони лишаються точними.</p>
          <div class="comparison" aria-label="Порівняння стандартного QR та A2">
            <div><span class="mini-grid mini-grid--standard"></span><b>Стандарт</b><small>Сітка модулів</small></div>
            <div class="comparison-arrow">→</div>
            <div><span class="mini-grid mini-grid--a2"></span><b>A2</b><small>Зв'язаний ритм</small></div>
          </div>
        </div>
      </div>
    </section>

    <section class="use-cases" id="use-cases" aria-label="Сценарії використання QR-коду">
      <div class="usecase-sticky">
        <div class="usecase-heading">
          <p class="section-index">04 / QR У ЖИТТІ</p>
          <h2>ОДИН КОД.<br /><em>РІЗНІ<br class="usecase-mobile-break" />СЦЕНАРІЇ.</em></h2>
          <p class="usecase-hint">ВІД СТОЛИКА ДО РАХУНКУ <span aria-hidden="true">→</span></p>
        </div>
        <div class="usecase-viewport" id="usecase-viewport">
          <div class="usecase-track" id="usecase-track">
            <article class="usecase-panel is-active" data-demo-url="https://menu.example/seasonal">
              <div class="usecase-art">
                <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1400&q=85" alt="Затишна кав'ярня з місцем для QR-меню" loading="lazy" />
                <span class="art-index">FIELD NOTE 01</span>
                <div class="case-qr" aria-hidden="true"></div>
                <span class="art-caption">TABLE 04 / MENU</span>
              </div>
              <div class="usecase-copy">
                <p class="usecase-type">01 — ГОСТИННІСТЬ</p>
                <h3>Меню,<br /><em>що відкривається.</em></h3>
                <p>На столику, в меню чи біля каси: один скан веде до актуальних позицій без повторного друку.</p>
                <button class="case-action" type="button">Зібрати QR для меню <span aria-hidden="true">↗</span></button>
              </div>
            </article>
            <article class="usecase-panel" data-demo-url="https://tickets.example/doors-open">
              <div class="usecase-art">
                <img src="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=85" alt="Глядачі на живому музичному виступі" loading="lazy" />
                <span class="art-index">FIELD NOTE 02</span>
                <div class="case-qr" aria-hidden="true"></div>
                <span class="art-caption">ENTRY / 19:30</span>
              </div>
              <div class="usecase-copy">
                <p class="usecase-type">02 — ПОДІЇ</p>
                <h3>Квиток,<br /><em>який веде далі.</em></h3>
                <p>Вхід, програма, мапа локації або післяподієвий матеріал — QR стає частиною квитка, а не випадковою наліпкою.</p>
                <button class="case-action" type="button">Зібрати QR для події <span aria-hidden="true">↗</span></button>
              </div>
            </article>
            <article class="usecase-panel" data-demo-url="https://objects.example/care">
              <div class="usecase-art">
                <img src="https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1400&q=85" alt="Багаторазова пляшка як приклад брендованого продукту" loading="lazy" />
                <span class="art-index">FIELD NOTE 03</span>
                <div class="case-qr" aria-hidden="true"></div>
                <span class="art-caption">OBJECT / STORY</span>
              </div>
              <div class="usecase-copy">
                <p class="usecase-type">03 — ПАКОВАННЯ</p>
                <h3>Річ має<br /><em>що розповісти.</em></h3>
                <p>Інструкція, походження, повторне замовлення чи догляд — упаковка продовжує розмову після покупки.</p>
                <button class="case-action" type="button">Зібрати QR для продукту <span aria-hidden="true">↗</span></button>
              </div>
            </article>
            <article class="usecase-panel" data-demo-url="https://pay.example/invoice-024">
              <div class="usecase-art">
                <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=85" alt="Оплата покупки на касі" loading="lazy" />
                <span class="art-index">FIELD NOTE 04</span>
                <div class="case-qr" aria-hidden="true"></div>
                <span class="art-caption">PAY / RECEIPT</span>
              </div>
              <div class="usecase-copy">
                <p class="usecase-type">04 — ОПЛАТА</p>
                <h3>Від скану<br /><em>до дії.</em></h3>
                <p>Платіжне посилання, чек або рахунок у тому самому виразному форматі — для екрана й друку.</p>
                <button class="case-action" type="button">Зібрати QR для оплати <span aria-hidden="true">↗</span></button>
              </div>
            </article>
          </div>
        </div>
        <div class="usecase-controls" aria-label="Навігація сценаріями">
          <button type="button" data-case-nav="-1" aria-label="Попередній сценарій">←</button>
          <div class="usecase-progress" aria-hidden="true"><span></span></div>
          <button type="button" data-case-nav="1" aria-label="Наступний сценарій">→</button>
          <span class="usecase-count"><b>01</b> / 04</span>
        </div>
      </div>
    </section>

    <section class="api-section" id="api">
      <div class="api-intro">
        <p class="section-index">05 / ОДИН ЗАПИТ</p>
        <h2>ВБУДУЙТЕ<br />ФОРМУ<br />В ПРОДУКТ.</h2>
        <p>Той самий результат для чеків, меню, квитків і платіжних сторінок. URL на вході, готове зображення на виході.</p>
      </div>
      <div class="code-panel">
        <div class="code-tabs" role="tablist" aria-label="Приклади інтеграції">
          <button class="is-active" data-code="curl" role="tab">cURL</button>
          <button data-code="html" role="tab">HTML</button>
          <button id="copy-code" class="copy-icon" aria-label="Копіювати код" title="Копіювати код">□</button>
        </div>
        <pre><code id="code-example"></code></pre>
        <div class="response-line"><span></span> 200 OK <b>image/svg+xml</b></div>
      </div>
    </section>

    <section class="proof">
      <p class="section-index">06 / СТВОРЕНО ДЛЯ РЕАЛЬНОГО СВІТУ</p>
      <div class="proof-list">
        <article><strong>01</strong><h3>Перевірте скан</h3><p>Перед друком перевірте готовий QR камерою телефона, особливо після додавання логотипа.</p></article>
        <article><strong>02</strong><h3>Векторний</h3><p>Чіткий на екрані, чеку, пакуванні або вітрині.</p></article>
        <article><strong>03</strong><h3>Програмний</h3><p>Передбачуваний API замість ручного експорту макетів.</p></article>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-mark">A2<span>/</span></div>
    <p>Перетворіть наступне<br />посилання на знак.</p>
    <a href="#studio">Створити QR <span aria-hidden="true">↗</span></a>
    <nav class="footer-links" aria-label="Навігація внизу сторінки"><a href="#payment-qr">QR НБУ</a><a href="#api">API</a><a href="#faq">Дані та оплата</a><a href="#use-cases">Сценарії</a></nav>
    <small>© 2026 A2 QR SYSTEM</small>
  </footer>
`

mountBankDemo()

const assistant = mountRahunokAssistant(document.querySelector<HTMLElement>('#rahunok-assistant')!, {
  qrValue: new URL(import.meta.env.BASE_URL, window.location.origin).href,
  preview: true,
})
if (import.meta.hot) import.meta.hot.dispose(() => assistant.destroy())

const input = document.querySelector<HTMLInputElement>('#qr-data')!
const density = document.querySelector<HTMLInputElement>('#density')!
const correctionLevel = document.querySelector<HTMLSelectElement>('#correction-level')!
const positioningType = document.querySelector<HTMLSelectElement>('#positioning-type')!
const contentScale = document.querySelector<HTMLInputElement>('#content-scale')!
const customLogoInput = document.querySelector<HTMLInputElement>('#custom-logo')!
const preview = document.querySelector<HTMLDivElement>('#qr-preview')!
const logoPreview = document.querySelector<HTMLDivElement>('#qr-logo-preview')!
const usecaseTrack = document.querySelector<HTMLDivElement>('#usecase-track')!
const usecaseViewport = document.querySelector<HTMLDivElement>('#usecase-viewport')!
const usecaseSection = document.querySelector<HTMLElement>('#use-cases')!
const usecasePanels = [...document.querySelectorAll<HTMLElement>('.usecase-panel')]
const status = document.querySelector<HTMLParagraphElement>('#status')!
const codeExample = document.querySelector<HTMLElement>('#code-example')!
const hero = document.querySelector<HTMLElement>('.hero')!
const signalCanvas = document.querySelector<HTMLCanvasElement>('#hero-signal')!
const signalContext = signalCanvas.getContext('2d')!
const titleQr = document.querySelector<HTMLSpanElement>('#title-qr')!
const nbuForm = document.querySelector<HTMLFormElement>('#nbu-form')!
const nbuResult = document.querySelector<HTMLElement>('#nbu-result')!
const nbuQr = document.querySelector<HTMLDivElement>('#nbu-qr')!
const nbuStatus = document.querySelector<HTMLParagraphElement>('#nbu-form-status')!
const nbuResultSummary = document.querySelector<HTMLParagraphElement>('#nbu-result-summary')!
const nbuResultState = document.querySelector<HTMLSpanElement>('#nbu-result-state')!
const nbuTool = document.querySelector<HTMLDivElement>('#payment-tool')!
const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle')!
const siteNav = document.querySelector<HTMLElement>('#site-nav')!
let tone: Tone = 'ink'
let lineStyle: LineStyle = 'horizontal'
let logoMode: LogoMode = 'rahunok'
let customLogoUrl = ''
let svgMarkup = ''
let logoSvgMarkup = ''
let activeCode: 'curl' | 'html' = 'curl'
let signalBits: ArrayLike<number> = []
let signalFrame = 0
let signalWidth = 0
let signalHeight = 0
let signalAim = { x: .52, y: .5 }
let nbuQrUrl = ''
let nbuQrFilename = 'nbu-payment-qr'
let hasRealNbuQr = false
let heroRenderVersion = 0
const rahunokLogo = '<circle cx="85.44" cy="85.44" r="85.44" fill="#ffffff"/><g transform="translate(37.4, 24)"><path d="M67.41,55.44l-14.8,12H96.08V80.64H39.7c-3.76,2.84-6,6.3-6,10.71,0,7.56,6,11.66,16.71,11.66,9.13,0,17-4.4,23.3-13.53L91,101.14c-9.43,14.5-26.46,21.74-42.53,21.74-21.11,0-36.84-10.07-36.84-26.77a24.07,24.07,0,0,1,5.66-15.44H0V67.44H27.71l15.13-12H0V42.24H56.07c4.1-3.77,6-7.24,6-11.34,0-6.6-6-11.33-15.13-11.33-8.83,0-16.37,5-21.74,13.53L8.5,21.74C17.64,7.24,32.44,0,48.51,0c21.73,0,35.9,11.34,35.9,26.77a26,26,0,0,1-5,15.44h16.7V55.44Z"/></g>'
const demoNbuUrl = 'https://example.invalid/qr-demo'

function addRahunokLogo(qrSvg: string) {
  const viewBox = qrSvg.match(/viewBox="([^"]+)"/)?.[1]
  if (!viewBox) throw new Error('Не вдалося підготувати QR-зображення.')
  const [originX, originY, width, height] = viewBox.split(/\s+/).map(Number)
  const diameter = Math.min(width, height) * .19
  const x = originX + (width - diameter) / 2
  const y = originY + (height - diameter) / 2
  const scale = diameter / 170.88
  const logo = `<g transform="translate(${x} ${y}) scale(${scale})">${rahunokLogo}</g>`
  return qrSvg.replace('</svg>', `${logo}</svg>`)
}

function inFinder(row: number, column: number, size: number) {
  return (row < 7 && column < 7) || (row < 7 && column >= size - 7) || (row >= size - 7 && column < 7)
}

function finderSvg(x: number, y: number, unit: number, color: string) {
  const shape = positioningType.value as PositioningType
  const radius = shape === 'circle' ? unit * 3.5 : shape === 'square' ? 0 : unit * 1.05
  const innerRadius = shape === 'circle' ? unit * 2.5 : shape === 'square' ? 0 : unit * .65
  const coreRadius = shape === 'circle' ? unit * 1.5 : shape === 'square' ? 0 : unit * .5
  return `<rect x="${x}" y="${y}" width="${unit * 7}" height="${unit * 7}" rx="${radius}" fill="${color}"/><rect x="${x + unit}" y="${y + unit}" width="${unit * 5}" height="${unit * 5}" rx="${innerRadius}" fill="#f7f5ed"/><rect x="${x + unit * 2}" y="${y + unit * 2}" width="${unit * 3}" height="${unit * 3}" rx="${coreRadius}" fill="${color}"/>`
}

function makeA2Svg(modules: QrModules, color: string, scale: number, withLogo = false) {
  const quiet = 4
  const unit = 10
  const full = (modules.size + quiet * 2) * unit
  const thickness = unit * scale
  const offset = (unit - thickness) / 2
  const parts: string[] = []

  for (let row = 0; row < modules.size; row++) {
    let column = 0
    while (column < modules.size) {
      if (!modules.data[row * modules.size + column] || inFinder(row, column, modules.size)) {
        column++
        continue
      }
      const start = column
      while (column + 1 < modules.size && modules.data[row * modules.size + column + 1] && !inFinder(row, column + 1, modules.size)) column++
      const length = column - start + 1
      const x = (start + quiet) * unit + offset
      const y = (row + quiet) * unit + offset
      parts.push(`<rect x="${x}" y="${y}" width="${length * unit - unit + thickness}" height="${thickness}" rx="${thickness / 2}" fill="${color}"/>`)
      column++
    }
  }

  const finder = [
    [quiet * unit, quiet * unit],
    [(quiet + modules.size - 7) * unit, quiet * unit],
    [quiet * unit, (quiet + modules.size - 7) * unit],
  ].map(([x, y]) => finderSvg(x, y, unit, color)).join('')
  const logoSize = modules.size * unit * .23
  const logoScale = logoSize / 170.88
  const logo = withLogo
    ? `<g transform="translate(${(full - logoSize) / 2} ${(full - logoSize) / 2}) scale(${logoScale})">${rahunokLogo}</g>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="geometricPrecision"><rect width="${full}" height="${full}" fill="#f7f5ed"/>${parts.join('')}${finder}${logo}</svg>`
}

function makeVerticalA2Svg(modules: QrModules, color: string, scale: number, withLogo = false) {
  const quiet = 4
  const unit = 10
  const full = (modules.size + quiet * 2) * unit
  const thickness = unit * scale
  const offset = (unit - thickness) / 2
  const parts: string[] = []

  for (let column = 0; column < modules.size; column++) {
    let row = 0
    while (row < modules.size) {
      if (!modules.data[row * modules.size + column] || inFinder(row, column, modules.size)) {
        row++
        continue
      }
      const start = row
      while (row + 1 < modules.size && modules.data[(row + 1) * modules.size + column] && !inFinder(row + 1, column, modules.size)) row++
      const length = row - start + 1
      const x = (column + quiet) * unit + offset
      const y = (start + quiet) * unit + offset
      parts.push(`<rect x="${x}" y="${y}" width="${thickness}" height="${length * unit - unit + thickness}" rx="${thickness / 2}" fill="${color}"/>`)
      row++
    }
  }

  const finder = [
    [quiet * unit, quiet * unit],
    [(quiet + modules.size - 7) * unit, quiet * unit],
    [quiet * unit, (quiet + modules.size - 7) * unit],
  ].map(([x, y]) => finderSvg(x, y, unit, color)).join('')
  const logoSize = modules.size * unit * .23
  const logoScale = logoSize / 170.88
  const logo = withLogo
    ? `<g transform="translate(${(full - logoSize) / 2} ${(full - logoSize) / 2}) scale(${logoScale})">${rahunokLogo}</g>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="geometricPrecision"><rect width="${full}" height="${full}" fill="#f7f5ed"/>${parts.join('')}${finder}${logo}</svg>`
}

function makeMixedA2Svg(modules: QrModules, color: string, scale: number, withLogo = false) {
  const quiet = 4
  const unit = 10
  const full = (modules.size + quiet * 2) * unit
  const thickness = unit * scale
  const offset = (unit - thickness) / 2
  const parts: string[] = []

  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (!modules.data[row * modules.size + column] || inFinder(row, column, modules.size)) continue
      const x = (column + quiet) * unit
      const y = (row + quiet) * unit
      const vertical = (row + column) % 2 === 1
      parts.push(vertical
        ? `<rect x="${x + offset}" y="${y}" width="${thickness}" height="${unit}" rx="${thickness / 2}" fill="${color}"/>`
        : `<rect x="${x}" y="${y + offset}" width="${unit}" height="${thickness}" rx="${thickness / 2}" fill="${color}"/>`)
    }
  }

  const finder = [
    [quiet * unit, quiet * unit],
    [(quiet + modules.size - 7) * unit, quiet * unit],
    [quiet * unit, (quiet + modules.size - 7) * unit],
  ].map(([x, y]) => finderSvg(x, y, unit, color)).join('')
  const logoSize = modules.size * unit * .23
  const logoScale = logoSize / 170.88
  const logo = withLogo
    ? `<g transform="translate(${(full - logoSize) / 2} ${(full - logoSize) / 2}) scale(${logoScale})">${rahunokLogo}</g>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="geometricPrecision"><rect width="${full}" height="${full}" fill="#f7f5ed"/>${parts.join('')}${finder}${logo}</svg>`
}

function makeDottedA2Svg(modules: QrModules, color: string, scale: number) {
  const quiet = 4
  const unit = 10
  const full = (modules.size + quiet * 2) * unit
  const radius = unit * scale / 2
  const parts: string[] = []

  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (!modules.data[row * modules.size + column] || inFinder(row, column, modules.size)) continue
      parts.push(`<circle cx="${(column + quiet + .5) * unit}" cy="${(row + quiet + .5) * unit}" r="${radius}" fill="${color}"/>`)
    }
  }

  const finder = [
    [quiet * unit, quiet * unit],
    [(quiet + modules.size - 7) * unit, quiet * unit],
    [quiet * unit, (quiet + modules.size - 7) * unit],
  ].map(([x, y]) => finderSvg(x, y, unit, color)).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="geometricPrecision"><rect width="${full}" height="${full}" fill="#f7f5ed"/>${parts.join('')}${finder}</svg>`
}

function applySelectedLogo(qrSvg: string) {
  if (logoMode === 'none') return qrSvg
  if (logoMode === 'rahunok') return addRahunokLogo(qrSvg)
  if (!customLogoUrl) return qrSvg
  const viewBox = qrSvg.match(/viewBox="([^"]+)"/)?.[1]
  if (!viewBox) return qrSvg
  const [originX, originY, width, height] = viewBox.split(/\s+/).map(Number)
  const size = Math.min(width, height) * .19
  const x = originX + (width - size) / 2
  const y = originY + (height - size) / 2
  const logo = `<g><circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="#ffffff"/><image href="${customLogoUrl}" x="${x + size * .1}" y="${y + size * .1}" width="${size * .8}" height="${size * .8}" preserveAspectRatio="xMidYMid meet"/></g>`
  return qrSvg.replace('</svg>', `${logo}</svg>`)
}

function apiUrl() {
  const params = new URLSearchParams({ data: input.value, style: 'a2', color: palette[tone].slice(1), format: 'svg' })
  return `${window.location.origin}${import.meta.env.BASE_URL}v1/create-qr-code/?${params}`
}

function makeStyledA2Svg(modules: QrModules, color: string, scale: number, withLogo = false) {
  if (lineStyle === 'vertical') return makeVerticalA2Svg(modules, color, scale, withLogo)
  if (lineStyle === 'mixed') return makeMixedA2Svg(modules, color, scale, withLogo)
  if (lineStyle === 'dots') return makeDottedA2Svg(modules, color, scale)
  return makeA2Svg(modules, color, scale, withLogo)
}

function styleQrSvg(markup: string, isDemo: boolean) {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const svg = parsed.documentElement
  if (svg.localName !== 'svg' || parsed.querySelector('parsererror')) throw new Error('Некоректний QR SVG')
  const color = palette[tone]
  const scale = Number(contentScale.value) / .6
  const shape = positioningType.value as PositioningType
  const viewBox = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
  if (!viewBox || viewBox.length !== 4) throw new Error('Некоректний розмір QR SVG')
  const [, , width] = viewBox
  const area = isDemo ? svg.querySelector('g') : null

  if (area) {
    area.setAttribute('fill', color)
  }
  for (const element of svg.querySelectorAll('rect,circle,path')) {
    const fill = element.getAttribute('fill')
    const stroke = element.getAttribute('stroke')
    if (fill && fill !== 'none' && fill.toLowerCase() !== '#f7f5ed' && fill.toLowerCase() !== '#ffffff' && fill.toLowerCase() !== '#fff') {
      element.setAttribute('fill', color)
    }
    if (stroke && stroke !== 'none') element.setAttribute('stroke', color)
  }
  if (!isDemo) {
    const finderRects = [...svg.querySelectorAll('rect[rx]')].slice(-9)
    const quiet = 40
    const size = width - quiet * 2
    const center = quiet + size / 2
    const radius = size * .115
    for (const element of svg.querySelectorAll('rect,circle')) {
      if (finderRects.includes(element as SVGRectElement) || element.getAttribute('fill') === '#f7f5ed') continue
      const x = Number(element.getAttribute('cx') ?? element.getAttribute('x'))
      const y = Number(element.getAttribute('cy') ?? element.getAttribute('y'))
      if (Math.abs(x - center) < radius && Math.abs(y - center) < radius) continue
      if (scale !== 1) element.setAttribute('transform', `translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`)
    }
  }
  if (isDemo && shape !== 'rounded') {
    for (const rect of svg.querySelectorAll('rect[rx]')) {
      const side = Number(rect.getAttribute('width'))
      if (side < width * .08 || side > width * .2) continue
      rect.setAttribute('rx', String(shape === 'circle' ? side / 2 : 0))
      rect.setAttribute('ry', String(shape === 'circle' ? side / 2 : 0))
    }
  }
  return new XMLSerializer().serializeToString(svg)
}

async function createDemoStyleQr(data: string, color: string, size = 960) {
  const params = new URLSearchParams({ data, style: 'a2', ecc: correctionLevel.value, color: color.slice(1), format: 'svg', size: String(size) })
  const response = await fetch(`${qrApiBase}/v1/create-qr-code/?${params}`, { mode: 'cors' })
  if (!response.ok) throw new Error(`A2 QR API повернув помилку ${response.status}.`)
  return response.text()
}

function heroQrSvg(markup: string) {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const svg = parsed.documentElement
  if (svg.localName !== 'svg' || parsed.querySelector('parsererror')) return markup
  const viewBox = svg.getAttribute('viewBox')?.split(/[\s,]+/).map(Number)
  if (!viewBox || viewBox.length !== 4 || viewBox.some(value => !Number.isFinite(value))) return markup
  const [x, y, width, height] = viewBox
  if (width <= 0 || height <= 0) return markup
  const background = parsed.createElementNS('http://www.w3.org/2000/svg', 'rect')
  background.setAttribute('x', String(x))
  background.setAttribute('y', String(y))
  background.setAttribute('width', String(width))
  background.setAttribute('height', String(height))
  background.setAttribute('fill', '#f7f5ed')
  svg.insertBefore(background, svg.firstChild)
  for (const rect of svg.querySelectorAll('rect')) {
    if (rect === background) continue
    const fill = rect.getAttribute('fill')?.toLowerCase()
    if ((fill === '#fff' || fill === '#ffffff' || fill === 'white') && Number(rect.getAttribute('width')) >= width * .9 && Number(rect.getAttribute('height')) >= height * .9) rect.setAttribute('fill', '#f7f5ed')
  }
  return new XMLSerializer().serializeToString(svg)
}

function updateCode() {
  const url = apiUrl()
  codeExample.textContent = activeCode === 'curl'
    ? `curl "${url}" \\\n  --output qr.svg`
    : `<img src="${url}" alt="QR code" />`
}

async function renderQr() {
  const renderVersion = ++heroRenderVersion
  density.disabled = lineStyle === 'demo'
  density.title = density.disabled ? 'У цьому стилі щільність визначає A2 API' : 'Щільність ліній'
  document.querySelectorAll<HTMLButtonElement>('[data-line-style], [data-tone], [data-logo-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.classList.contains('is-active')))
  })
  try {
    const value = input.value.trim()
    if (!value) throw new Error('Введіть посилання')
    const ecc = correctionLevel.value as CorrectionLevel
    const qr = QRCode.create(value, { errorCorrectionLevel: ecc })
    signalBits = qr.modules.data
    const logoQr = QRCode.create(value, { errorCorrectionLevel: ecc })
    const heroModules = logoQr.modules as QrModules
    const color = palette[tone]
    const scale = Number(density.value) / 100
    let baseSvg: string
    let titleSvg: string
    let logoBase: string

    if (lineStyle === 'demo') {
      try {
        baseSvg = await createDemoStyleQr(value, color)
        if (renderVersion !== heroRenderVersion) return
        titleSvg = baseSvg
        logoBase = baseSvg
      } catch {
        baseSvg = makeA2Svg(logoQr.modules as QrModules, color, .72)
        titleSvg = baseSvg
        logoBase = baseSvg
      }
    } else {
      baseSvg = makeStyledA2Svg(qr.modules as QrModules, color, scale)
      titleSvg = makeStyledA2Svg(heroModules, color, .82)
      logoBase = makeStyledA2Svg(logoQr.modules as QrModules, color, scale)
    }

    if (renderVersion !== heroRenderVersion) return
    const demoStyle = lineStyle === 'demo'
    svgMarkup = styleQrSvg(baseSvg, demoStyle)
    titleQr.innerHTML = heroQrSvg(styleQrSvg(titleSvg, demoStyle))
    logoSvgMarkup = applySelectedLogo(styleQrSvg(logoBase, demoStyle))
    preview.innerHTML = heroQrSvg(demoStyle ? svgMarkup : styleQrSvg(makeStyledA2Svg(heroModules, color, scale), false))
    logoPreview.innerHTML = heroQrSvg(logoSvgMarkup)
    document.querySelectorAll<HTMLElement>('.case-qr').forEach((caseQr) => { caseQr.innerHTML = svgMarkup })
    status.textContent = 'QR сформовано · перевірте скан перед друком'
    status.classList.remove('is-error')
    updateCode()
    drawSignal(performance.now(), true)
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Не вдалося створити QR'
    status.classList.add('is-error')
  }
}

function resizeSignal() {
  const bounds = hero.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  signalWidth = bounds.width
  signalHeight = bounds.height
  signalCanvas.width = Math.round(signalWidth * pixelRatio)
  signalCanvas.height = Math.round(signalHeight * pixelRatio)
  signalContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  drawSignal(performance.now(), true)
}

function drawSignal(time: number, still = false) {
  if (getComputedStyle(signalCanvas).display === 'none') return
  if (!signalWidth || !signalHeight) return

  const heroBounds = hero.getBoundingClientRect()
  const sourceBounds = document.querySelector('.url-control button')!.getBoundingClientRect()
  const targetBounds = document.querySelector('.qr-stage')!.getBoundingClientRect()
  const startX = sourceBounds.left + sourceBounds.width * .5 - heroBounds.left
  const startY = sourceBounds.top + sourceBounds.height * .5 - heroBounds.top
  const endX = targetBounds.left + targetBounds.width * .5 - heroBounds.left
  const endY = targetBounds.bottom + 20 - heroBounds.top
  const bend = Math.max(48, Math.abs(endX - startX) * .34)
  const aimX = signalAim.x * signalWidth
  const aimY = signalAim.y * signalHeight
  const control1 = {
    x: startX + bend + (aimX - (startX + endX) / 2) * .12,
    y: startY - Math.min(190, signalHeight * .22) + (aimY - (startY + endY) / 2) * .2
  }
  const control2 = {
    x: endX - bend * .52 + (aimX - (startX + endX) / 2) * .12,
    y: endY + Math.min(82, signalHeight * .1) + (aimY - (startY + endY) / 2) * .08
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const elapsed = reducedMotion ? 0 : time
  const normalLength = Math.hypot(endX - startX, endY - startY) || 1
  const normal = { x: -(endY - startY) / normalLength, y: (endX - startX) / normalLength }
  const tracks = [-16, -5, 5, 16].map((offset) => ({
    start: { x: startX + normal.x * offset, y: startY + normal.y * offset },
    control1: { x: control1.x + normal.x * offset, y: control1.y + normal.y * offset },
    control2: { x: control2.x + normal.x * offset, y: control2.y + normal.y * offset },
    end: { x: endX + normal.x * offset, y: endY + normal.y * offset }
  }))

  signalContext.clearRect(0, 0, signalWidth, signalHeight)
  const pathColor = signalContext.createLinearGradient(startX, startY, endX, endY)
  pathColor.addColorStop(0, 'rgba(240, 68, 36, 0)')
  pathColor.addColorStop(.48, 'rgba(240, 68, 36, .3)')
  pathColor.addColorStop(1, 'rgba(23, 71, 209, .45)')
  signalContext.strokeStyle = pathColor
  signalContext.setLineDash([2, 8])
  signalContext.lineDashOffset = reducedMotion ? 0 : -(elapsed * .018) % 10
  tracks.forEach((track, index) => {
    signalContext.beginPath()
    signalContext.moveTo(track.start.x, track.start.y)
    signalContext.bezierCurveTo(track.control1.x, track.control1.y, track.control2.x, track.control2.y, track.end.x, track.end.y)
    signalContext.globalAlpha = index === 1 || index === 2 ? .82 : .42
    signalContext.lineWidth = index === 1 || index === 2 ? 1.25 : .8
    signalContext.stroke()
  })
  signalContext.globalAlpha = 1
  signalContext.setLineDash([])

  const sourceSize = signalBits.length
  const particleCount = Math.min(240, Math.max(140, Math.floor(sourceSize * .28)))
  for (let index = 0; index < particleCount; index++) {
    const bitIndex = sourceSize ? Math.floor(index * sourceSize / particleCount) : 0
    if (sourceSize && !signalBits[bitIndex]) continue
    const phase = reducedMotion ? .82 : ((elapsed * .000075 + index / particleCount) % 1)
    const inverse = 1 - phase
    const track = tracks[index % tracks.length]
    const x = inverse ** 3 * track.start.x + 3 * inverse ** 2 * phase * track.control1.x + 3 * inverse * phase ** 2 * track.control2.x + phase ** 3 * track.end.x
    const y = inverse ** 3 * track.start.y + 3 * inverse ** 2 * phase * track.control1.y + 3 * inverse * phase ** 2 * track.control2.y + phase ** 3 * track.end.y
    const pulse = reducedMotion ? 1 : .72 + Math.sin(elapsed * .004 + index * .63) * .28
    const size = (2.8 + (index % 4) * .9) * pulse
    signalContext.fillStyle = index % 7 === 0 ? `rgba(23, 71, 209, ${.35 + pulse * .5})` : `rgba(240, 68, 36, ${.26 + pulse * .5})`
    signalContext.fillRect(x - size / 2, y - size / 2, size, size)
  }

  const ringRadius = 5 + (reducedMotion ? 0 : (Math.sin(elapsed * .002) + 1) * 3)
  signalContext.beginPath()
  signalContext.arc(endX, endY, ringRadius, 0, Math.PI * 2)
  signalContext.strokeStyle = 'rgba(23, 71, 209, .6)'
  signalContext.lineWidth = 1
  signalContext.stroke()

  if (!still && !reducedMotion && !document.hidden) signalFrame = window.requestAnimationFrame(drawSignal)
}

function startSignal() {
  if (signalFrame) window.cancelAnimationFrame(signalFrame)
  signalFrame = 0
  resizeSignal()
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden) {
    signalFrame = window.requestAnimationFrame(drawSignal)
  }
}

hero.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') return
  const bounds = hero.getBoundingClientRect()
  signalAim = {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
  }
}, { passive: true })

function flash(message: string) {
  status.textContent = message
  window.setTimeout(() => { status.textContent = 'Готовий до сканування' }, 1800)
}

document.querySelector<HTMLFormElement>('#generator-form')!.addEventListener('submit', (event) => {
  event.preventDefault()
  renderQr()
})

input.addEventListener('input', renderQr)
density.addEventListener('input', renderQr)
for (const control of [correctionLevel, positioningType, contentScale]) {
  control.addEventListener('input', () => {
    if (control === contentScale) {
      document.querySelector<HTMLOutputElement>(`#${control.id}-value`)!.value = control.value
    }
    renderQr()
  })
}

document.querySelectorAll<HTMLButtonElement>('[data-line-style]').forEach((button) => {
  button.addEventListener('click', () => {
    lineStyle = button.dataset.lineStyle as LineStyle
    document.querySelectorAll('[data-line-style]').forEach((item) => item.classList.remove('is-active'))
    button.classList.add('is-active')
    renderQr()
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-logo-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    logoMode = button.dataset.logoMode as LogoMode
    document.querySelectorAll('[data-logo-mode]').forEach((item) => item.classList.remove('is-active'))
    button.classList.add('is-active')
    renderQr()
  })
})

customLogoInput.addEventListener('change', () => {
  const file = customLogoInput.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.addEventListener('load', () => {
    customLogoUrl = String(reader.result ?? '')
    logoMode = 'custom'
    document.querySelectorAll('[data-logo-mode]').forEach((item) => item.classList.remove('is-active'))
    document.querySelector('.logo-upload')?.classList.add('is-active')
    renderQr()
  })
  reader.readAsDataURL(file)
})

document.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach((button) => {
  button.addEventListener('click', () => {
    tone = button.dataset.tone as Tone
    document.querySelectorAll('[data-tone]').forEach((item) => item.classList.remove('is-active'))
    button.classList.add('is-active')
    renderQr()
  })
})

document.querySelectorAll<HTMLButtonElement>('[data-code]').forEach((button) => {
  button.addEventListener('click', () => {
    activeCode = button.dataset.code as 'curl' | 'html'
    document.querySelectorAll('[data-code]').forEach((item) => item.classList.remove('is-active'))
    button.classList.add('is-active')
    updateCode()
  })
})

document.querySelector<HTMLButtonElement>('#download')!.addEventListener('click', () => {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml' })
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = 'a2-qr.svg'
  anchor.click()
  URL.revokeObjectURL(anchor.href)
  flash('SVG завантажено')
})

document.querySelector<HTMLButtonElement>('#download-logo')!.addEventListener('click', () => {
  const blob = new Blob([logoSvgMarkup], { type: 'image/svg+xml' })
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = 'a2-qr-logo.svg'
  anchor.click()
  URL.revokeObjectURL(anchor.href)
  flash('SVG з логотипом завантажено')
})

document.querySelector<HTMLButtonElement>('#copy-url')!.addEventListener('click', async () => {
  await navigator.clipboard.writeText(apiUrl())
  flash('API URL скопійовано')
})

document.querySelector<HTMLButtonElement>('#copy-code')!.addEventListener('click', async () => {
  await navigator.clipboard.writeText(codeExample.textContent ?? '')
  flash('Код скопійовано')
})

function readNbuForm(): NbuFormInput {
  const formData = new FormData(nbuForm)
  return {
    recipientName: String(formData.get('recipientName') ?? ''),
    recipientTaxId: String(formData.get('recipientTaxId') ?? ''),
    recipientIban: String(formData.get('recipientIban') ?? ''),
    amount: String(formData.get('amount') ?? ''),
    purpose: String(formData.get('purpose') ?? '')
  }
}

async function createBrandedNbuQr(url: string, size = 960) {
  const params = new URLSearchParams({ data: url, style: 'a2', ecc: 'H', format: 'svg', size: String(size) })
  const response = await fetch(`${qrApiBase}/v1/create-qr-code/?${params}`, { mode: 'cors' })
  if (!response.ok) throw new Error(`A2 QR API повернув помилку ${response.status}.`)
  return addRahunokLogo(await response.text())
}

async function showDemoNbuQr() {
  hasRealNbuQr = false
  nbuQrUrl = ''
  try {
    nbuQr.innerHTML = await createBrandedNbuQr(demoNbuUrl, 720)
  } catch {
    nbuQr.replaceChildren()
    nbuStatus.textContent = 'A2 QR API недоступний. Перевірте локальний Worker на порту 8789.'
    nbuStatus.classList.add('is-error')
  }
  nbuResult.classList.remove('has-real-qr')
  nbuResultState.textContent = 'ДЕМО · НЕ ДЛЯ ОПЛАТИ'
  nbuResultSummary.textContent = 'Демо-код · веде на example.invalid'
  document.querySelector<HTMLButtonElement>('#nbu-download-svg')!.disabled = true
  document.querySelector<HTMLButtonElement>('#nbu-download')!.disabled = true
  document.querySelector<HTMLButtonElement>('#nbu-copy')!.disabled = true
}

nbuForm.querySelectorAll<HTMLInputElement>('input[maxlength]').forEach((field) => {
  const counter = document.querySelector<HTMLElement>(`[data-count-for="${field.id}"]`)
  const updateCounter = () => {
    if (counter) counter.textContent = String(field.value.length)
    field.removeAttribute('aria-invalid')
    nbuStatus.textContent = 'Поля перевіряються локально перед генерацією.'
    nbuStatus.classList.remove('is-error')
  }
  field.addEventListener('input', updateCounter)
  updateCounter()
})

nbuForm.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])').forEach((field) => {
  field.addEventListener('input', () => {
    if (!hasRealNbuQr) return
    nbuTool.classList.remove('has-result')
    void showDemoNbuQr()
    nbuStatus.textContent = 'Реквізити змінено. Згенеруйте QR ще раз.'
  })
})

nbuForm.querySelector<HTMLInputElement>('#nbu-consent')!.addEventListener('change', (event) => {
  const consent = event.currentTarget as HTMLInputElement
  if (consent.checked || !hasRealNbuQr) return
  nbuTool.classList.remove('has-result')
  void showDemoNbuQr()
  nbuStatus.textContent = 'Згоду скасовано. Підтвердьте її перед повторною генерацією.'
})

nbuForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const inputData = readNbuForm()
  const invalid = validateNbuInput(inputData)
  if (invalid) {
    const field = nbuForm.elements.namedItem(invalid.field) as HTMLInputElement | null
    field?.setAttribute('aria-invalid', 'true')
    nbuStatus.textContent = invalid.message
    nbuStatus.classList.add('is-error')
    field?.focus()
    return
  }

  const consent = nbuForm.elements.namedItem('consent') as HTMLInputElement | null
  if (!consent?.checked) {
    nbuStatus.textContent = 'Підтвердьте обробку реквізитів у браузері.'
    nbuStatus.classList.add('is-error')
    consent?.focus()
    return
  }

  try {
    const payload = generateNbuPayload(inputData)
    const qrSvg = await createBrandedNbuQr(payload.qrUrl)
    nbuQr.innerHTML = qrSvg
    nbuQrUrl = payload.qrUrl
    hasRealNbuQr = true
    nbuQrFilename = `nbu-transfer-${inputData.recipientTaxId.replace(/\D/g, '') || 'payment'}`
    nbuResultSummary.textContent = `${inputData.recipientName.trim()} · ${inputData.amount.trim() ? `${Number(inputData.amount.replace(',', '.')).toFixed(2).replace('.', ',')} ₴` : 'сума на вибір платника'}`
    nbuResultState.textContent = 'ПЛАТІЖНИЙ QR · ГОТОВИЙ'
    nbuResult.classList.add('has-real-qr')
    document.querySelector<HTMLButtonElement>('#nbu-download-svg')!.disabled = false
    document.querySelector<HTMLButtonElement>('#nbu-download')!.disabled = false
    document.querySelector<HTMLButtonElement>('#nbu-copy')!.disabled = false
    nbuTool.classList.add('has-result')
    nbuStatus.textContent = 'Платіжний QR створено. Він веде на офіційну адресу НБУ.'
    nbuStatus.classList.remove('is-error')
  } catch (error) {
    nbuStatus.textContent = error instanceof Error ? error.message : 'Не вдалося сформувати NBU QR.'
    nbuStatus.classList.add('is-error')
  }
})

document.querySelector<HTMLButtonElement>('#nbu-download-svg')!.addEventListener('click', async () => {
  if (!nbuQrUrl) return
  const svg = await createBrandedNbuQr(nbuQrUrl, 1200)
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  anchor.download = `${nbuQrFilename}.svg`
  anchor.click()
  URL.revokeObjectURL(anchor.href)
})

document.querySelector<HTMLButtonElement>('#nbu-download')!.addEventListener('click', async () => {
  if (!nbuQrUrl) return
  const svg = await createBrandedNbuQr(nbuQrUrl, 1200)
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  const image = new Image()
  image.src = objectUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1200
  const context = canvas.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(objectUrl)
  const anchor = document.createElement('a')
  anchor.href = canvas.toDataURL('image/png')
  anchor.download = `${nbuQrFilename}.png`
  anchor.click()
})

document.querySelector<HTMLButtonElement>('#nbu-copy')!.addEventListener('click', async () => {
  if (!nbuQrUrl) return
  await navigator.clipboard.writeText(nbuQrUrl)
  nbuStatus.textContent = 'Посилання офіційного NBU QR скопійовано.'
})

nbuTool.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') return
  const bounds = nbuTool.getBoundingClientRect()
  nbuTool.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`)
  nbuTool.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`)
}, { passive: true })

function setMenuOpen(open: boolean) {
  menuToggle.setAttribute('aria-expanded', String(open))
  document.body.classList.toggle('menu-open', open)
  if (open) siteNav.querySelector<HTMLAnchorElement>('a')?.focus()
}

menuToggle.addEventListener('click', () => {
  setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true')
})
siteNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuOpen(false)))
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    setMenuOpen(false)
    menuToggle.focus()
  }
})
window.matchMedia('(min-width: 901px)').addEventListener('change', (event) => {
  if (event.matches) setMenuOpen(false)
})

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll<HTMLElement>('.scroll-reveal, .motion-section').forEach((element) => element.classList.add('is-visible'))
} else if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready')
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    })
  }, { threshold: .16 })
  document.querySelectorAll<HTMLElement>('.scroll-reveal').forEach((element) => revealObserver.observe(element))
  const sectionObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    })
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' })
  document.querySelectorAll<HTMLElement>('.motion-section').forEach((section) => sectionObserver.observe(section))
} else {
  document.querySelectorAll<HTMLElement>('.scroll-reveal, .motion-section').forEach((element) => element.classList.add('is-visible'))
}

let activeCase = 0
let scrollFrame = 0

function setActiveCase(index: number) {
  activeCase = Math.max(0, Math.min(usecasePanels.length - 1, index))
  usecasePanels.forEach((panel, panelIndex) => panel.classList.toggle('is-active', panelIndex === activeCase))
  document.querySelector('.usecase-count b')!.textContent = String(activeCase + 1).padStart(2, '0')
  document.querySelector<HTMLElement>('.usecase-progress span')!.style.transform = `scaleX(${(activeCase + 1) / usecasePanels.length})`
}

function updateUsecaseMotion() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    usecaseTrack.style.removeProperty('transform')
    const gap = Number.parseFloat(getComputedStyle(usecaseTrack).gap) || 0
    setActiveCase(Math.round(usecaseViewport.scrollLeft / (usecasePanels[0].getBoundingClientRect().width + gap)))
    return
  }
  const panelWidth = usecasePanels[0].getBoundingClientRect().width
  const gap = Number.parseFloat(getComputedStyle(usecaseTrack).gap) || 0
  const travel = usecaseSection.offsetHeight - window.innerHeight
  const sectionTop = usecaseSection.getBoundingClientRect().top + window.scrollY
  const progress = Math.max(0, Math.min(1, (window.scrollY - sectionTop) / travel))
  const offset = progress * (usecasePanels.length - 1)
  usecaseTrack.style.transform = `translate3d(-${offset * (panelWidth + gap)}px, 0, 0)`
  setActiveCase(Math.round(offset))
}

window.addEventListener('scroll', () => {
  if (scrollFrame) return
  scrollFrame = window.requestAnimationFrame(() => {
    updateUsecaseMotion()
    scrollFrame = 0
  })
}, { passive: true })

window.addEventListener('resize', updateUsecaseMotion, { passive: true })
window.addEventListener('resize', resizeSignal, { passive: true })
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.cancelAnimationFrame(signalFrame)
    signalFrame = 0
  } else {
    startSignal()
  }
})
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', startSignal)
usecaseViewport.addEventListener('scroll', () => {
  if (!window.matchMedia('(max-width: 800px), (prefers-reduced-motion: reduce)').matches) return
  const panelWidth = usecasePanels[0].getBoundingClientRect().width
  setActiveCase(Math.round(usecaseViewport.scrollLeft / (panelWidth + 18)))
}, { passive: true })

document.querySelectorAll<HTMLButtonElement>('[data-case-nav]').forEach((button) => {
  button.addEventListener('click', () => {
    const direction = Number(button.dataset.caseNav)
    const nextCase = Math.max(0, Math.min(usecasePanels.length - 1, activeCase + direction))
    if (window.matchMedia('(max-width: 800px), (prefers-reduced-motion: reduce)').matches) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        usecasePanels[nextCase].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      } else {
        const sectionTop = usecaseSection.getBoundingClientRect().top + window.scrollY
        window.scrollTo({ top: sectionTop + (usecaseSection.offsetHeight - window.innerHeight) * nextCase / (usecasePanels.length - 1), behavior: 'smooth' })
      }
    } else {
      const sectionTop = usecaseSection.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: sectionTop + (usecaseSection.offsetHeight - window.innerHeight) * nextCase / (usecasePanels.length - 1), behavior: 'smooth' })
    }
  })
})

document.querySelectorAll<HTMLButtonElement>('.case-action').forEach((button, index) => {
  button.addEventListener('click', () => {
    input.value = usecasePanels[index].dataset.demoUrl ?? ''
    renderQr()
    document.querySelector('#studio')?.scrollIntoView({ behavior: 'smooth' })
  })
})

renderQr()
updateUsecaseMotion()
startSignal()
void showDemoNbuQr()

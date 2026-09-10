# rakhunok.com Production Workers

Ця директорія містить конфігурації Cloudflare Workers виключно для бойового домену **https://rakhunok.com/**.

## Правила безпеки та ізоляції

1. **Повна ізоляція від staging**:
   - Конфігурації для `https://letsrealtalk.com/` знаходяться в директорії `../worker/` і не змінюються цими скриптами.
   - Усі воркери в цій директорії мають префікс `rakhunok-` (`rakhunok-web`, `rakhunok-dashboard`, `rakhunok-corex`, `rakhunok-app`, `rakhunok-checkout`, `rakhunok-conf`).
   - Єдина зона в Cloudflare: `rakhunok.com`.

2. **Маршрутизація (Routes)**:
   - `rakhunok.com/*` -> `rakhunok-web`
   - `rakhunok.com/dashboard*` -> `rakhunok-dashboard`
   - `rakhunok.com/corex*` -> `rakhunok-corex`
   - `rakhunok.com/app*` -> `rakhunok-app`
   - `rakhunok.com/checkout*`, `rakhunok.com/pay*`, `rakhunok.com/o/*`, `rakhunok.com/t/*`, `rakhunok.com/tag/*`, `rakhunok.com/pos/*` -> `rakhunok-checkout`
   - `rakhunok.com/conf*` -> `rakhunok-conf`

3. **Сухі прогони (Dry-run)**:
   Перед будь-яким деплоєм рекомендується запустити сухий прогін без публікації:
   ```powershell
   npm run check:all
   ```

4. **Розгортання (Deploy)**:
   Для повного безпечного розгортання з кореня репозиторію:
   ```powershell
   npm run rakhunok:deploy
   ```
   Або окремих сервісів з цієї папки:
   ```powershell
   npm run deploy:web
   npm run deploy:dashboard
   npm run deploy:corex
   npm run deploy:app
   npm run deploy:checkout
   npm run deploy:conf
   ```

5. **План відкату (Rollback)**:
   Якщо потрібен швидкий відкат будь-якого компонента:
   У Cloudflare Dashboard відкрити відповідний Worker -> **Settings** -> **Domains & Routes** -> Видалити або вимкнути маршрут. Трафік миттєво повернеться до попереднього обробника.

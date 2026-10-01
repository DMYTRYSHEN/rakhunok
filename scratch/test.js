const url = new URL('https://rhnk.pp.ua/api/v1/bank-logo/NOVA');
const matchLogo = url.pathname.match(/^\/api\/v1\/bank-logo\/([a-zA-Z0-9_-]+)$/i);
console.log(matchLogo);

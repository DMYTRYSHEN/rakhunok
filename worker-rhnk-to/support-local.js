const query = selector => document.querySelector(selector);
let csrf;
let state;
let prepared;
let busy = false;
let currentTab = 'invoices';
const errors = { ELEVATION_REQUIRED: 'Записи недоступні. Поновіть локальний дозвіл.', REVISION_CONFLICT: 'Правила вже змінилися. Оновіть дані й підготуйте операцію знову.',
  SUPPORT_FORBIDDEN: 'Сесія завершена або недоступна.', CONFIRMATION_EXPIRED: 'Підтвердження прострочене. Підготуйте операцію знову.',
  INVALID_SETTINGS: 'Перевірте IBAN, префікс, номер і строк дії.', INVALID_AMOUNT: 'Невірна сума рахунку.', REFERENCE_REQUIRED: 'Вкажіть стіл або адресу доставки.' };
const scenarioNames = { fixed: 'Фіксована сума', open_amount: 'Відкрита сума', table: 'Стіл', delivery: 'Доставка' };
function notice(message, error = false) {
  query('#notice').textContent = message;
  query('#notice').className = error ? 'error' : '';
}
async function api(path, input) {
  const response = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-support-csrf': csrf }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) {
    const error = Error(errors[result.error] ?? result.error ?? 'Операція недоступна');
    error.code = result.error;
    throw error;
  }
  return result;
}
async function run(work) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try { await work(); } catch (error) { notice(error.message, true); }
  finally {
    busy = false;
    document.querySelectorAll('button').forEach(button => { button.disabled = false; });
    updateAccess();
  }
}
function textCell(row, text, small) {
  const cell = document.createElement('td');
  cell.textContent = text;
  if (small) { const detail = document.createElement('small'); detail.textContent = small; cell.append(detail); }
  row.append(cell);
}
function money(amount) { return amount === null ? 'Відкрита' : `${(amount / 100).toLocaleString('uk-UA', { minimumFractionDigits: 2 })} UAH`; }
function date(timestamp) { return new Date(timestamp).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function updateAccess() {
  const canWrite = state?.session?.capabilities?.includes('invoice.create') && state.session.expiresAt > Date.now();
  query('#new-invoice').disabled = busy || !canWrite;
  query('#save-settings').disabled = busy || !canWrite;
  query('#commit').disabled = busy || !query('#acknowledged').checked;
  query('#elevate').hidden = !state?.session;
  query('#access-label').textContent = canWrite ? 'Локальні записи дозволені' : 'Лише перегляд';
  query('#elevate').textContent = canWrite ? 'Поновити локальний дозвіл' : 'Дозволити локальні записи';
}
function render() {
  const session = state.session;
  query('#entry').hidden = !!session;
  query('#workspace').hidden = !session;
  if (!session) { prepared = null; return; }
  const business = state.business;
  query('#workspace-label').textContent = session.workspace === 'sandbox' ? 'SANDBOX · Режим підтримки' : 'LIVE · Локальна симуляція підтримки';
  query('#support-banner').classList.toggle('live', session.workspace === 'live');
  query('#session-detail').textContent = `Demo Atelier · ${session.reason} · ${session.projectId}`;
  query('#revision').textContent = `Ревізія ${business.revision}`;
  query('#settings-revision').textContent = `Ревізія ${business.revision}`;
  query('#session-id').textContent = `Сесія ${session.id}`;
  query('#invoice-count').textContent = business.invoices.length;
  query('#invoices').replaceChildren();
  for (const invoice of business.invoices) {
    const row = document.createElement('tr');
    textCell(row, invoice.number, invoice.title);
    textCell(row, scenarioNames[invoice.scenario], invoice.reference);
    textCell(row, money(invoice.amountMinor));
    textCell(row, invoice.expiresAt <= Date.now() ? 'Строк минув' : invoice.status === 'preparing' ? 'Підготовка' : 'Очікує оплати');
    textCell(row, date(invoice.expiresAt));
    query('#invoices').append(row);
  }
  if (!business.invoices.length) {
    const row = document.createElement('tr'); const cell = document.createElement('td');
    cell.colSpan = 5; cell.className = 'empty'; cell.textContent = 'Рахунків немає'; row.append(cell); query('#invoices').append(row);
  }
  for (const [key, value] of Object.entries(business.settings)) query('#settings-form').elements.namedItem(key).value = value;
  query('#audit').replaceChildren();
  for (const entry of state.audit.filter(entry => entry.sessionId === session.id)) {
    const row = document.createElement('tr');
    textCell(row, date(entry.timestamp)); textCell(row, entry.action, entry.actorId);
    textCell(row, entry.outcome ?? 'recorded'); textCell(row, entry.operationId ?? entry.requestId ?? entry.sessionId);
    query('#audit').append(row);
  }
  selectTab(currentTab); updateAccess(); updateTimer();
}
function selectTab(tab) {
  currentTab = tab;
  for (const name of ['invoices', 'settings', 'audit']) {
    query(`#${name}-panel`).hidden = name !== tab;
    query(`[data-tab="${name}"]`).classList.toggle('selected', name === tab);
    query(`[data-tab="${name}"]`).setAttribute('aria-current', name === tab ? 'page' : 'false');
  }
}
async function refresh() { state = await api('snapshot', { sessionId: state.session.id }); render(); }
function summaryRow(label, value) {
  const row = document.createElement('div'); row.className = 'summary-row';
  const name = document.createElement('span'); name.textContent = label;
  const detail = document.createElement('strong'); detail.textContent = value;
  row.append(name, detail); query('#confirmation-summary').append(row);
}
async function prepare(operation) {
  prepared = await api('prepare', { sessionId: state.session.id, operation });
  query('#confirmation-summary').replaceChildren();
  summaryRow('Середовище', state.session.workspace === 'sandbox' ? 'Sandbox · локальні дані' : 'Live · локальна симуляція');
  summaryRow('Клієнт', 'Demo Atelier');
  if (operation.action === 'invoice.create') {
    query('#confirm-title').textContent = 'Підтвердити рахунок';
    summaryRow('Сценарій', scenarioNames[prepared.scenario]); summaryRow('Призначення', prepared.title);
    summaryRow('Сума', money(prepared.amountMinor));
    if (prepared.reference) summaryRow('Стіл / адреса', prepared.reference);
    summaryRow('Номер', `${state.business.settings.prefix}-${state.business.settings.nextNumber}`);
    summaryRow('Строк дії', `${state.business.settings.lifetime} хв`);
  } else {
    query('#confirm-title').textContent = 'Підтвердити зміни правил';
    const labels = { paymentRequisites: 'IBAN', prefix: 'Префікс', nextNumber: 'Наступний номер', lifetime: 'Строк дії, хв' };
    for (const [key, value] of Object.entries(prepared.settings)) summaryRow(labels[key], `${state.business.settings[key]} → ${value}`);
    summaryRow('Ревізія', prepared.expectedRevision);
  }
  query('#confirmation-id').textContent = `Операція: ${prepared.id}\nSHA-256: ${prepared.payloadDigest}\nДіє до: ${date(prepared.expiresAt)}`;
  query('#acknowledged').checked = false; query('#commit').disabled = true;
  query('#confirm-dialog').showModal();
}
async function cancelConfirmation() {
  if (!prepared) { query('#confirm-dialog').close(); return; }
  await api('cancel', { sessionId: state.session.id, operationId: prepared.id });
  prepared = null; query('#confirm-dialog').close(); await refresh(); notice('Операцію скасовано. Записів не зроблено.');
}
query('#open-form').addEventListener('submit', event => {
  event.preventDefault(); run(async () => {
    state = await api('open', Object.fromEntries(new FormData(event.target))); currentTab = 'invoices'; render(); notice('Локальну сесію підтримки відкрито.');
  });
});
query('#exit').addEventListener('click', () => run(async () => {
  state = await api('end', { sessionId: state.session.id }); prepared = null;
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); render();
  notice('Підтримку завершено. Ви у власному контексті адміністратора. Збережені записи не скасовано.');
}));
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.tab)));
query('#refresh').addEventListener('click', () => run(refresh));
query('#elevate').addEventListener('click', () => query('#elevation-dialog').showModal());
query('#cancel-elevation').addEventListener('click', () => query('#elevation-dialog').close());
query('#approve-elevation').addEventListener('click', () => run(async () => {
  state = await api('elevate', { sessionId: state.session.id, acknowledged: true }); query('#elevation-dialog').close(); render(); notice('Записи дозволені лише в локальній симуляції.');
}));
query('#new-invoice').addEventListener('click', () => query('#invoice-dialog').showModal());
for (const selector of ['#close-invoice', '#cancel-invoice']) query(selector).addEventListener('click', () => query('#invoice-dialog').close());
query('#invoice-form').elements.scenario.addEventListener('change', event => {
  const scenario = event.target.value;
  query('#amount-label').hidden = scenario === 'open_amount'; query('#invoice-form').elements.amount.required = scenario !== 'open_amount';
  query('#reference-label').hidden = !['table', 'delivery'].includes(scenario);
  query('#invoice-form').elements.reference.required = ['table', 'delivery'].includes(scenario);
});
query('#invoice-form').addEventListener('submit', event => {
  event.preventDefault(); run(async () => {
    const values = Object.fromEntries(new FormData(event.target));
    await prepare({ action: 'invoice.create', ...values, amount: Number(values.amount) }); query('#invoice-dialog').close();
  });
});
query('#settings-form').addEventListener('submit', event => {
  event.preventDefault(); run(async () => {
    const values = Object.fromEntries(new FormData(event.target));
    await prepare({ action: 'settings.update', expectedRevision: state.business.revision,
      settings: { ...values, nextNumber: Number(values.nextNumber), lifetime: Number(values.lifetime) } });
  });
});
query('#acknowledged').addEventListener('change', updateAccess);
for (const selector of ['#close-confirm', '#cancel-confirm']) query(selector).addEventListener('click', () => run(cancelConfirmation));
query('#confirm-dialog').addEventListener('cancel', event => { event.preventDefault(); run(cancelConfirmation); });
query('#commit').addEventListener('click', () => run(async () => {
  const operationId = prepared.id;
  let result;
  try {
    result = await api('commit', { sessionId: state.session.id, operationId, acknowledged: query('#acknowledged').checked });
  } catch (error) {
    if (['REVISION_CONFLICT', 'CONFIRMATION_EXPIRED'].includes(error.code)) {
      query('#confirm-dialog').close(); prepared = null; await refresh();
    }
    throw error;
  }
  query('#confirm-dialog').close(); prepared = null; await refresh();
  notice(`Збережено: ${result.number ?? `ревізія ${result.revision}`} · операція ${operationId}`);
}));
function updateTimer() {
  if (!state?.session) return;
  const remaining = Math.max(0, Math.ceil((state.session.expiresAt - Date.now()) / 1000));
  query('#timer').textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  if (!remaining && !busy) run(async () => {
    state = await api('end', { sessionId: state.session.id }); render();
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); notice('Час сесії минув. Підтримку завершено.');
  });
}
setInterval(updateTimer, 1000);
run(async () => {
  const response = await fetch('/api/bootstrap'); const result = await response.json();
  if (!response.ok) throw Error('Локальний сервер недоступний');
  csrf = result.csrf; state = result; render();
});
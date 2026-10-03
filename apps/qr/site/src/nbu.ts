export interface NbuFormInput {
  recipientName: string
  recipientTaxId: string
  recipientIban: string
  amount: string
  purpose: string
}

export interface NbuPayload {
  fields: string[]
  raw: string
  encoded: string
  qrUrl: string
}

export interface NbuValidationError {
  field: keyof NbuFormInput
  message: string
}

export function isValidUkrainianIban(value: string): boolean {
  const iban = value.replace(/\s+/g, '').toUpperCase()
  if (!/^UA\d{27}$/.test(iban)) return false

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  let remainder = 0
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export function validateNbuInput(input: NbuFormInput): NbuValidationError | null {
  const recipientName = input.recipientName.trim()
  const taxId = input.recipientTaxId.replace(/\s+/g, '')
  const amount = input.amount.trim().replace(',', '.')
  const purpose = input.purpose.trim()

  if (!recipientName || recipientName.length > 70) {
    return { field: 'recipientName', message: 'Вкажіть отримувача (до 70 символів).' }
  }
  if (!/^(?:\d{8}|\d{10})$/.test(taxId)) {
    return { field: 'recipientTaxId', message: 'Введіть 8 цифр ЄДРПОУ або 10 цифр РНОКПП.' }
  }
  if (!isValidUkrainianIban(input.recipientIban)) {
    return { field: 'recipientIban', message: 'Перевірте український IBAN і контрольні цифри.' }
  }
  if (amount && (!/^\d{1,9}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)) {
    return { field: 'amount', message: 'Сума має бути більшою за 0, до 2 знаків після коми.' }
  }
  if (!purpose || purpose.length > 140) {
    return { field: 'purpose', message: 'Вкажіть призначення (до 140 символів).' }
  }
  return null
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function timestamp(date: Date): string {
  return `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`
}

export function generateNbuPayload(input: NbuFormInput, now = new Date()): NbuPayload {
  const error = validateNbuInput(input)
  if (error) throw new Error(error.message)

  const recipient = input.recipientName.trim().replace(/[„“”]/g, '"')
  const taxId = input.recipientTaxId.replace(/\s+/g, '')
  const iban = input.recipientIban.replace(/\s+/g, '').toUpperCase()
  const amount = input.amount.trim().replace(',', '.')
  const purpose = input.purpose.trim().replace(/[„“”]/g, '"')
  const createdAt = timestamp(now)
  const validUntil = `${createdAt.slice(0, 2)}1231235959`
  const reference = `A2-${now.getTime().toString(36).toUpperCase()}`
  const fields = [
    'BCD',
    '003',
    '1',
    'ICT',
    '',
    recipient,
    iban,
    amount ? `UAH${Number(amount).toFixed(2)}` : '',
    taxId,
    'OTHR/GDDS',
    reference,
    purpose,
    '',
    'FFFF',
    validUntil,
    createdAt,
    ''
  ]
  const raw = fields.join('\n')
  const encoded = encodeBase64Url(raw)

  return {
    fields,
    raw,
    encoded,
    qrUrl: `https://qr.bank.gov.ua/${encoded}`
  }
}
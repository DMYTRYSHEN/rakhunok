import type { Bank } from '../types/bank.js';

export const DEFAULT_BANKS: Bank[] = [
  {
    name: 'Monobank',
    code: 'UNJS',
    id: 'mono',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/a7/06/5a/a7065ad9-93f8-5705-4b1a-81ade2916c05/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #000000, #2c2c2e)',
    active: true
  },
  {
    name: 'Приват24',
    code: 'PBAN',
    id: 'pb',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/57/f8/e0/57f8e0bf-783f-766a-b52b-ba630accaef1/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
    feePct: 0.5,
    active: true
  },
  {
    name: 'Sense Bank',
    code: 'SENS',
    id: 'sensebank',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/06/da/1c/06da1ccf-fdb3-ae36-cf00-e258e76e2284/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #0d3264, #1a4f94)',
    active: true
  },
  {
    name: 'Абанк',
    code: 'ABUA',
    id: 'abank24',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/3a/76/1e/3a761e68-39dc-51ad-f189-e9d89227442c/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #9e9d24, #827717)',
    active: true
  },
  {
    name: 'ПУМБ',
    code: 'FUIB',
    id: 'pumb',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/02/0a/09/020a099e-1a78-877b-6394-0919c2b247c4/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #e53935, #b71c1c)',
    active: true
  },
  {
    name: 'Райффайзен Банк',
    code: 'AVAL',
    id: 'myraif',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/2f/8f/ce/2f8fced9-fdee-7c58-2346-88d943faa770/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #fbc02d, #f57f17)',
    active: true
  },
  {
    name: 'NovaPay',
    code: 'NOVA',
    id: 'NovaPay',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/80/be/f7/80bef75a-fca9-ec80-98b8-dad73437089c/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #f44336, #c62828)',
    active: true
  },
  {
    name: 'izibank',
    code: 'TASB',
    id: 'izibank',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/fa/dd/6d/fadd6db5-56ff-c4ba-fd98-cc48f34b4997/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #ff9800, #e65100)',
    active: true
  },
  {
    name: 'Глобус Банк',
    code: 'GLBU',
    id: 'globus',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/cf/31/7d/cf317d36-9ed8-4918-e96f-c6e0622f8fb6/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #0288d1, #01579b)',
    active: true
  },
  {
    name: 'Bank Lviv Online',
    code: 'LVIV',
    id: 'lviv',
    logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/cf/24/47/cf244747-62ff-6fd4-9352-b09e6e929998/Placeholder.mill/200x200bb-75.webp',
    bg: 'linear-gradient(135deg, #2267c6, #1b539e)',
    active: true
  }
];

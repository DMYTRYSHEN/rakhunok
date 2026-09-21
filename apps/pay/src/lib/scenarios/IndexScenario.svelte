<script lang="ts">
  import { vibrate } from '../state/checkout.svelte.js';

  interface ScenarioItem {
    id: string;
    title: string;
    sub?: string;
    badge?: string;
    badgeColor?: string;
    url: string;
    iconBg: string;
    iconColor: string;
    svgPath: string;
  }

  interface ScenarioGroup {
    id: string;
    title: string;
    items: ScenarioItem[];
  }

  let selectedFilter = $state<string>('all');

  const groups: ScenarioGroup[] = [
    {
      id: 'verticals',
      title: 'Готові індустрії (Вертикалі)',
      items: [
        {
          id: 'demo-vertical-fitness',
          title: 'Фітнес-Центр / Абонементи',
          sub: 'Абонемент (1 800 ₴) + Басейн + Шафка #142 + 4 Тренування = 4 700 ₴ · Apple Pass',
          badge: 'Абонемент',
          badgeColor: '#10b981',
          url: './?demo=vertical_fitness',
          iconBg: 'rgba(16, 185, 129, 0.15)',
          iconColor: '#10b981',
          svgPath: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>'
        },
        {
          id: 'demo-vertical-events',
          title: 'Концерти / Кіно / Квитки',
          sub: 'Вибір сеансу, схема залу, 2 стандарт + 1 преміум + збір = 910 ₴ · Таймер 10 хв',
          badge: 'Квитки',
          badgeColor: '#8b5cf6',
          url: './?demo=vertical_events',
          iconBg: 'rgba(139, 92, 246, 0.15)',
          iconColor: '#8b5cf6',
          svgPath: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>'
        },
        {
          id: 'demo-vertical-cleaning',
          title: 'Клінінговий Сервіс',
          sub: '50 м² + духовка + 4 вікна + Зона Б = 4 100 ₴ (Аванс 30% = 1 230 ₴)',
          badge: 'Калькулятор',
          badgeColor: '#06b6d4',
          url: './?demo=vertical_cleaning',
          iconBg: 'rgba(6, 182, 212, 0.15)',
          iconColor: '#06b6d4',
          svgPath: '<path d="m16 4 3 3-9 9-4 1 1-4 9-9Z"/><path d="m15 5 3 3"/><path d="M21 21H3"/>'
        },
        {
          id: 'demo-vertical-auto',
          title: 'СТО / Шиномонтаж',
          sub: 'Легкове авто → Комплексний шиномонтаж R16 (800 ₴) → Дата та час',
          badge: 'Запис',
          badgeColor: '#3b82f6',
          url: './?demo=vertical_auto',
          iconBg: 'rgba(59, 130, 246, 0.15)',
          iconColor: '#3b82f6',
          svgPath: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2 11 2 11.2 2 11.4V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'
        },
        {
          id: 'demo-vertical-beauty',
          title: 'Салон краси / Барбершоп',
          sub: 'Стрижка + фарбування (довге волосся) + Майстер Олена = 1 800 ₴',
          badge: 'Послуги',
          badgeColor: '#ec4899',
          url: './?demo=vertical_beauty',
          iconBg: 'rgba(236, 72, 153, 0.15)',
          iconColor: '#ec4899',
          svgPath: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>'
        },
        {
          id: 'demo-vertical-pets',
          title: 'Грумінг Салон / Ветклініка',
          sub: 'Собака 10–20 кг, ковтуни (оцінка майстром + передоплата 300 ₴)',
          badge: 'Оцінка',
          badgeColor: '#f59e0b',
          url: './?demo=vertical_pets',
          iconBg: 'rgba(245, 158, 11, 0.15)',
          iconColor: '#f59e0b',
          svgPath: '<circle cx="12" cy="12" r="3"/><path d="M12 3a3 3 0 0 0-3 3v2a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 13a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-2a3 3 0 0 1 6 0v2a3 3 0 0 0 2 0Z"/>'
        },
        {
          id: 'demo-vertical-flowers',
          title: 'Магазин квітів',
          sub: 'Букет «Ніжність» L + листівка + кур’єр по місту = 1 450 ₴',
          badge: 'Букети',
          badgeColor: '#f43f5e',
          url: './?demo=vertical_flowers',
          iconBg: 'rgba(244, 63, 94, 0.15)',
          iconColor: '#f43f5e',
          svgPath: '<path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5M12 7.5A4.5 4.5 0 1 0 7.5 12M12 7.5V12m4.5 0a4.5 4.5 0 1 1-4.5 4.5M16.5 12H12m-4.5 0a4.5 4.5 0 1 0 4.5 4.5M7.5 12H12m0 4.5V21"/>'
        },
        {
          id: 'demo-vertical-gifts',
          title: 'Подарунки / Індивідуальні',
          sub: 'Дерев’яний бокс + гравіювання + макет дизайнера (300 ₴) = 1 550 ₴',
          badge: 'Макет',
          badgeColor: '#d946ef',
          url: './?demo=vertical_gifts',
          iconBg: 'rgba(217, 70, 239, 0.15)',
          iconColor: '#d946ef',
          svgPath: '<polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>'
        }
      ]
    },
    {
      id: 'fuel',
      title: 'АЗС & Автозаправки',
      items: [
        {
          id: 'demo-fuel-station',
          title: 'Оплата пального на АЗС',
          sub: 'Колонка 1, А-95 (59.50 ₴/л), 20 літрів = 1 190 ₴ · Прямий налив',
          badge: 'АЗС 7',
          badgeColor: '#38bdf8',
          url: './?demo=fuel_station',
          iconBg: 'rgba(56, 189, 248, 0.15)',
          iconColor: '#38bdf8',
          svgPath: '<path d="M3 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2v0a2 2 0 0 0 2-2V8l-3-3"/><rect x="6" y="6" width="6" height="5" rx="1"/>'
        }
      ]
    },
    {
      id: 'ecom',
      title: 'Онлайн-замовлення (E-commerce)',
      items: [
        {
          id: 'demo-1',
          title: 'Класичне замовлення',
          sub: 'Rozetka 1 240 ₴ · чистий чекаут без товарів',
          badge: 'Оригінал',
          badgeColor: '#38bdf8',
          url: './?demo=1',
          iconBg: 'rgba(10, 132, 255, 0.15)',
          iconColor: '#0a84ff',
          svgPath: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'
        },
        {
          id: 'demo-order-upsell',
          title: 'Замовлення з товарами та Upsell',
          sub: 'Розкривний кошик + 1-Click Order Bump',
          badge: 'Order Bump',
          badgeColor: '#a855f7',
          url: './?demo=order_upsell',
          iconBg: 'rgba(168, 85, 247, 0.15)',
          iconColor: '#a855f7',
          svgPath: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>'
        },
        {
          id: 'demo-order-full',
          title: 'Повний флагманський чекаут',
          sub: 'Товари + Upsell + Округлення ЗСУ + Бонуси + BNPL',
          badge: 'All-in-One',
          badgeColor: '#22c55e',
          url: './?demo=order_full',
          iconBg: 'rgba(34, 197, 94, 0.15)',
          iconColor: '#22c55e',
          svgPath: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>'
        },
        {
          id: 'demo-loyalty',
          title: 'Картка лояльності та сканер',
          sub: 'Окреме вікно: видошукач камери, штрих-код, Apple Pass',
          badge: 'Сканер',
          badgeColor: '#0a84ff',
          url: './?demo=loyalty',
          iconBg: 'rgba(10, 132, 255, 0.15)',
          iconColor: '#0a84ff',
          svgPath: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>'
        }
      ]
    },

    {
      id: 'horeca',
      title: 'Ресторани та HoReCa',
      items: [
        {
          id: 'demo-3',
          title: 'Класичний рахунок за столиком',
          sub: 'Столик 12 (386 ₴) · поділ чека, чайові, TTL',
          badge: 'Оригінал',
          badgeColor: '#38bdf8',
          url: './?demo=3',
          iconBg: 'rgba(255, 159, 10, 0.15)',
          iconColor: '#ff9f0a',
          svgPath: '<path d="M4 18v3M20 18v3M3 10h18M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M4 14h16"/>'
        },
        {
          id: 'demo-table-items',
          title: 'Рахунок з позиціями та дозамовленням',
          sub: 'Склад чека (Паста, Капучино) + дозамовлення',
          badge: 'Страви',
          badgeColor: '#a855f7',
          url: './?demo=table_items',
          iconBg: 'rgba(168, 85, 247, 0.15)',
          iconColor: '#a855f7',
          svgPath: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>'
        },
        {
          id: 'demo-table-full',
          title: 'Флагманський стіл з розщепленням',
          sub: 'Склад + Upsell + Поділ + Чайові + Блок DAC7',
          badge: 'DAC7',
          badgeColor: '#f59e0b',
          url: './?demo=table_full',
          iconBg: 'rgba(245, 158, 11, 0.15)',
          iconColor: '#f59e0b',
          svgPath: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'
        },
        {
          id: 'demo-waiting',
          title: 'Столик в очікуванні рахунку',
          sub: '«Каса формує чек» · автооновлення при закритті',
          badge: 'Статус',
          badgeColor: '#ec4899',
          url: './?demo=waiting',
          iconBg: 'rgba(236, 72, 153, 0.15)',
          iconColor: '#ec4899',
          svgPath: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
        }
      ]
    },
    {
      id: 'p2p',
      title: 'Каса, Донати та P2P',
      items: [
        {
          id: 'demo-2',
          title: 'Оплата на касі / Відкрита сума',
          sub: 'Кав’ярня «Крапка» · сенсорний Keypad та пресети',
          badge: 'POS Keypad',
          badgeColor: '#38bdf8',
          url: './?demo=2',
          iconBg: 'rgba(94, 92, 230, 0.15)',
          iconColor: '#5e5ce6',
          svgPath: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="16" y1="18" x2="16.01" y2="18"/>'
        },
        {
          id: 'demo-tips',
          title: 'Персональні чайові офіціанту',
          sub: 'Олександр (4.96 ★) з QR на бейджі · пресети 20–200 ₴',
          badge: 'Чайові',
          badgeColor: '#22c55e',
          url: './?demo=tips',
          iconBg: 'rgba(48, 209, 88, 0.15)',
          iconColor: '#30d158',
          svgPath: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
        },
        {
          id: 'demo-donation',
          title: 'Волонтерська Банка на ЗСУ',
          sub: '10 FPV-дронів для 72-ї ОМБр · прогрес 145/200 тис. ₴',
          badge: 'ЗСУ',
          badgeColor: '#ef4444',
          url: './?demo=donation',
          iconBg: 'rgba(239, 68, 68, 0.15)',
          iconColor: '#ef4444',
          svgPath: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'
        },
        {
          id: 'demo-krapka',
          title: 'Каталог кав’ярні «Крапка»',
          sub: 'Вітринне меню кави та десертів з прямим чекаутом',
          badge: 'Revtag',
          badgeColor: '#a855f7',
          url: './?demo=krapka',
          iconBg: 'rgba(217, 119, 6, 0.15)',
          iconColor: '#d97706',
          svgPath: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>'
        },
        {
          id: 'demo-sofia',
          title: 'Профіль $sofia_k',
          sub: 'Персональна платіжна сторінка для збору коштів',
          badge: 'P2P',
          badgeColor: '#6366f1',
          url: './?demo=sofia',
          iconBg: 'rgba(99, 102, 241, 0.15)',
          iconColor: '#6366f1',
          svgPath: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
        },
        {
          id: 'demo-bondar',
          title: 'Профіль водія $bondar_taxi',
          sub: 'Швидка безготівкова оплата поїздки в таксі по QR',
          badge: 'Таксі',
          badgeColor: '#eab308',
          url: './?demo=bondar',
          iconBg: 'rgba(234, 179, 8, 0.15)',
          iconColor: '#eab308',
          svgPath: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2 11 2 11.2 2 11.4V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'
        }
      ]
    },
    {
      id: 'delivery',
      title: 'Доставка та Логістика',
      items: [
        {
          id: 'demo-4',
          title: 'Замовлення з доставкою Новою Поштою',
          sub: 'Відділення (70 ₴), поштомат (65 ₴), кур’єр (120 ₴)',
          badge: 'Нова пошта',
          badgeColor: '#ed1b24',
          url: './?demo=4',
          iconBg: 'rgba(237, 27, 36, 0.15)',
          iconColor: '#ed1b24',
          svgPath: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5v10Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'
        }
      ]
    },
    {
      id: 'status',
      title: 'Фіскалізація та Статуси',
      items: [
        {
          id: 'demo-paid',
          title: 'Успішна оплата (E-commerce)',
          sub: '1 240 ₴ оплачено · NPS відгук, ТТН, Apple Wallet',
          badge: 'NPS відгуки',
          badgeColor: '#22c55e',
          url: './?demo=paid',
          iconBg: 'rgba(34, 197, 94, 0.15)',
          iconColor: '#22c55e',
          svgPath: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
        },
        {
          id: 'demo-paid-table',
          title: 'Успішна оплата столика (HoReCa)',
          sub: 'Live трекер кухні (~8 хв) + фіскальний чек ДПС',
          badge: 'Live Кухня',
          badgeColor: '#22c55e',
          url: './?demo=paid_table',
          iconBg: 'rgba(16, 185, 129, 0.15)',
          iconColor: '#10b981',
          svgPath: '<path d="M6 13.8V4a2 2 0 1 1 4 0v9.8M14 13.8V4a2 2 0 1 1 4 0v9.8"/><path d="M4 10h16M12 2v20"/>'
        },
        {
          id: 'demo-receipt',
          title: 'Електронний чек ДПС (ПРРО)',
          sub: 'cabinet.tax.gov.ua, QR-код, ПДВ 20%, розподіл',
          badge: 'ПРРО ДПС',
          badgeColor: '#38bdf8',
          url: './?demo=receipt',
          iconBg: 'rgba(56, 189, 248, 0.15)',
          iconColor: '#38bdf8',
          svgPath: '<path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2 2 7h20Z"/>'
        },
        {
          id: 'demo-timeout',
          title: 'Таймаут відповіді банку',
          sub: '«Не отримали відповідь від банку» з автоповтором',
          badge: 'Помилка',
          badgeColor: '#f97316',
          url: './?demo=timeout',
          iconBg: 'rgba(249, 115, 22, 0.15)',
          iconColor: '#f97316',
          svgPath: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
        }
      ]
    }
  ];

  const filterTabs = [
    { id: 'all', label: 'Всі', count: 28 },
    { id: 'verticals', label: 'Вертикалі', count: 8 },
    { id: 'fuel', label: 'АЗС', count: 1 },
    { id: 'ecom', label: 'E-com', count: 4 },
    { id: 'horeca', label: 'HoReCa', count: 4 },
    { id: 'p2p', label: 'Каса/P2P', count: 6 },
    { id: 'delivery', label: 'Доставка', count: 1 },
    { id: 'status', label: 'Статуси', count: 4 }
  ];

  const visibleGroups = $derived(
    selectedFilter === 'all'
      ? groups
      : groups.filter((g) => g.id === selectedFilter)
  );

  function setFilter(id: string): void {
    vibrate(6);
    selectedFilter = id;
  }

  function openLink(url: string): void {
    vibrate(8);
    window.location.href = url;
  }
</script>

<div class="screen-content index-hub-screen">
  <header class="apple-hub-header">
    <div class="apple-hub-badge">
      <span class="apple-hub-dot"></span>
      <span>Rahunok Showcase</span>
    </div>
    <h1 class="apple-hub-title">Сценарії оплати</h1>
    <p class="apple-hub-sub">
      28 автономних екранів для індустрій, e-commerce, HoReCa, каси та логістики.
    </p>

    <!-- Apple Segmented Filter Bar -->
    <div class="apple-filter-bar">
      {#each filterTabs as tab}
        <button
          class="apple-filter-pill"
          class:active={selectedFilter === tab.id}
          onclick={() => setFilter(tab.id)}
        >
          <span>{tab.label}</span>
          <span class="pill-count">{tab.count}</span>
        </button>
      {/each}
    </div>
  </header>

  <div class="apple-groups-list">
    {#each visibleGroups as grp}
      <section class="apple-group-section">
        <div class="apple-section-header">
          <span class="apple-section-title">{grp.title}</span>
          <span class="apple-section-count">{grp.items.length}</span>
        </div>

        <div class="apple-inset-card">
          {#each grp.items as item}
            <button
              class="index-item-card apple-item-row"
              onclick={() => openLink(item.url)}
            >
              <div class="apple-item-left">
                <div
                  class="apple-icon-squircle"
                  style="background: {item.iconBg}; color: {item.iconColor};"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    stroke="currentColor"
                    stroke-width="2"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    {@html item.svgPath}
                  </svg>
                </div>
                <div class="apple-item-text">
                  <div class="apple-item-title-row">
                    <span class="apple-item-title">{item.title}</span>
                    {#if item.badge}
                      <span
                        class="apple-item-badge"
                        style="color: {item.badgeColor || 'var(--accent)'}; background: {item.badgeColor ? `${item.badgeColor}18` : 'rgba(255,255,255,0.08)'};"
                      >
                        {item.badge}
                      </span>
                    {/if}
                  </div>
                  {#if item.sub}
                    <span class="apple-item-sub">{item.sub}</span>
                  {/if}
                </div>
              </div>

              <div class="apple-item-right">
                <code class="apple-item-code">{item.url.replace('./', '')}</code>
                <svg
                  class="apple-chevron"
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  stroke="currentColor"
                  stroke-width="2.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  <footer class="apple-hub-footer">
    <span>Готово до використання в продакшені · Автономні сценарії</span>
  </footer>
</div>

<style>
  .index-hub-screen {
    padding: 12px 14px 40px;
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
    min-height: 100%;
    box-sizing: border-box;
  }

  .apple-hub-header {
    text-align: center;
    margin-bottom: 14px;
    padding-top: 4px;
  }

  .apple-hub-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    color: #38bdf8;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .apple-hub-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 6px #38bdf8;
  }

  .apple-hub-title {
    font-size: 23px;
    font-weight: 800;
    color: var(--order-text);
    letter-spacing: -0.5px;
    margin: 0 0 4px;
  }

  .apple-hub-sub {
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--order-text-dim);
    margin: 0 0 12px;
  }

  /* Apple Segmented Filter Bar */
  .apple-filter-bar {
    display: flex;
    gap: 5px;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    justify-content: flex-start;
  }

  .apple-filter-bar::-webkit-scrollbar {
    display: none;
  }

  .apple-filter-pill {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    background: var(--order-surface);
    border: 1px solid var(--order-divider);
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--order-text-dim);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    font-family: inherit;
  }

  .apple-filter-pill:active {
    transform: scale(0.96);
  }

  .apple-filter-pill.active {
    background: var(--order-text);
    color: var(--order-bg);
    border-color: var(--order-text);
  }

  .apple-filter-pill.active .pill-count {
    background: rgba(0, 0, 0, 0.2);
    color: inherit;
  }

  :global(body.light-mode) .apple-filter-pill.active .pill-count {
    background: rgba(255, 255, 255, 0.3);
  }

  .pill-count {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 6px;
    background: var(--order-divider);
    color: var(--order-text-dim);
  }

  /* Apple Grouped Inset List */
  .apple-groups-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .apple-group-section {
    display: flex;
    flex-direction: column;
  }

  .apple-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px 6px;
  }

  .apple-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--order-text-dim);
  }

  .apple-section-count {
    font-size: 11px;
    font-weight: 600;
    color: var(--order-text-dim);
    opacity: 0.8;
  }

  .apple-inset-card {
    background: var(--order-surface);
    border: 1px solid var(--order-divider);
    border-radius: 14px;
    overflow: hidden;
  }

  /* Row Item */
  .apple-item-row {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-bottom: 0.5px solid var(--order-divider);
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: inherit;
    box-sizing: border-box;
  }

  .apple-item-row:last-child {
    border-bottom: none;
  }

  .apple-item-row:hover,
  .apple-item-row:active {
    background: rgba(255, 255, 255, 0.05);
  }

  :global(body.light-mode) .apple-item-row:hover,
  :global(body.light-mode) .apple-item-row:active {
    background: rgba(0, 0, 0, 0.03);
  }

  .apple-item-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .apple-icon-squircle {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .apple-item-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    gap: 1px;
  }

  .apple-item-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .apple-item-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--order-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .apple-item-badge {
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 5px;
    flex-shrink: 0;
    line-height: 1.2;
  }

  .apple-item-sub {
    font-size: 11px;
    color: var(--order-text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .apple-item-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .apple-item-code {
    font-size: 10.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: var(--order-text-dim);
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 5px;
    border-radius: 5px;
    border: 0.5px solid var(--order-divider);
  }

  :global(body.light-mode) .apple-item-code {
    background: rgba(0, 0, 0, 0.04);
  }

  .apple-chevron {
    color: var(--order-text-dim);
    opacity: 0.6;
    flex-shrink: 0;
  }

  .apple-hub-footer {
    text-align: center;
    padding: 20px 8px 12px;
    font-size: 11.5px;
    color: var(--order-text-dim);
    opacity: 0.7;
  }
</style>

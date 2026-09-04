import type { ProfileData } from '../types/profile.js';

export const DEFAULT_PROFILES: Record<string, ProfileData> = {
  krapka: {
    slug: 'krapka',
    type: 'cafe',
    name: "Кав’ярня «Крапка»",
    description: 'Кава, сніданки та десерти на Подолі',
    verified: true,
    handle: null,
    metaItems: [
      { icon: 'pin', text: 'Київ, Поділ' },
      { icon: 'clock', text: 'Відчинено до 20:00' }
    ],
    avatar: { type: 'text', val: 'К', bg: 'linear-gradient(135deg, #26c6da, #00838f)' },
    quickPay: {
      enabled: true,
      label: 'Сплатити довільну суму',
      presets: [100, 200, 500],
      purpose: 'Оплата в кав’ярні'
    },
    linksTitle: 'Зв’язатися',
    links: [
      {
        type: 'telegram',
        label: 'Замовити в Telegram',
        icon: 'M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l3-4'
      },
      {
        type: 'instagram',
        label: 'Наш Instagram',
        icon: 'M12 2c2.717 0 3.056.01 4.122.06c1.065.05 1.79.217 2.428.465c.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428c.047 1.066.06 1.405.06 4.122s-.01 3.056-.06 4.122c-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772a4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465c-1.066.047-1.405.06-4.122.06s-3.056-.01-4.122-.06c-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153a4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12s.01-3.056.06-4.122c.05-1.065.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10a5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 0 0-2.5 0a1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6a3 3 0 0 1 0-6z'
      },
      {
        type: 'maps',
        label: 'Як нас знайти',
        icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5a2.5 2.5 0 0 1 0 5z'
      }
    ],
    products: [
      {
        id: 'cappuccino',
        name: 'Капучино',
        price: 75,
        image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300&h=300&fit=crop'
      },
      {
        id: 'syrnyk',
        name: 'Львівський сирник',
        price: 110,
        image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=300&h=300&fit=crop'
      }
    ],
    trust: {
      rows: ['Реквізити ФОП підтверджено', 'Номер телефону перевірено'],
      footer: 'Профіль працює з травня 2025 року'
    }
  },
  sofia: {
    slug: 'sofia_k',
    type: 'person',
    name: 'Софія Коваленко',
    description: 'Студентка КНУ ім. Шевченка · Перекази за оренду, поїздки й спільні витрати',
    verified: true,
    handle: '$sofia_k',
    metaItems: [
      { icon: 'pin', text: 'Київ' },
      { icon: 'shield', text: 'Номер підтверджено' }
    ],
    avatar: { type: 'text', val: 'С', bg: 'linear-gradient(135deg, #ff7eb3, #8b5cf6)' },
    quickPay: {
      enabled: true,
      label: 'Переказати кошти',
      presets: [100, 300, 500],
      purpose: 'Переказ Софії'
    },
    linksTitle: 'Соцмережі — щоб переконатись, що це я',
    links: [
      {
        type: 'instagram',
        label: 'Instagram',
        sub: '@sofia.kovalenko · 2 340 підписників',
        icon: 'M12 2c2.717 0 3.056.01 4.122.06c1.065.05 1.79.217 2.428.465c.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428c.047 1.066.06 1.405.06 4.122s-.01 3.056-.06 4.122c-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772a4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465c-1.066.047-1.405.06-4.122.06s-3.056-.01-4.122-.06c-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153a4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12s.01-3.056.06-4.122c.05-1.065.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10a5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 0 0-2.5 0a1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6a3 3 0 0 1 0-6z'
      },
      {
        type: 'tiktok',
        label: 'TikTok',
        sub: '@sofia_k · 18 400 підписників',
        badge: { text: '♪', bg: '#000000', color: '#ffffff' }
      },
      {
        type: 'telegram',
        label: 'Написати в Telegram',
        sub: 'Відповідає за кілька хвилин',
        icon: 'M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l3-4'
      },
      {
        type: 'linkedin',
        label: 'LinkedIn',
        sub: 'Досвід і портфоліо',
        badge: { text: 'in', bg: '#0a66c2', color: '#ffffff' }
      }
    ],
    trust: {
      rows: [
        'Номер телефону підтверджено',
        'Профіль пов’язано з Instagram і TikTok',
        'Верифіковано в Rahunok'
      ],
      footer: 'У Rahunok з вересня 2024 · 85 переказів без скарг'
    }
  },
  bondar: {
    slug: 'bondar_taxi',
    type: 'person',
    name: 'Олексій Бондар',
    description: 'Водій таксі · ФОП 2-ї групи · Приймаю оплату напряму, без комісії застосунку',
    verified: true,
    handle: '$bondar_taxi',
    metaItems: [
      { icon: 'star', text: '4.9 · 1 240+ поїздок' },
      { icon: 'car', text: 'На лінії зараз' }
    ],
    avatar: { type: 'text', val: 'О', bg: 'linear-gradient(135deg, #ffc93c, #f7931e)' },
    quickPay: {
      enabled: true,
      label: 'Оплатити поїздку',
      presets: [80, 120, 200],
      purpose: 'Оплата поїздки'
    },
    linksTitle: 'Профілі водія — для перевірки перед оплатою',
    links: [
      {
        type: 'uklon',
        label: 'Профіль в Uklon',
        sub: '4.9 ★ · Перевірений водій',
        badge: { text: 'U', bg: '#00b26e', color: '#ffffff' }
      },
      {
        type: 'bolt',
        label: 'Профіль в Bolt',
        sub: '4.8 ★ · Верифіковано',
        badge: { text: 'B', bg: '#34d1a0', color: '#0d0e13' }
      },
      {
        type: 'uber',
        label: 'Профіль в Uber',
        sub: '4.9 ★ · Pro-водій',
        badge: { text: 'U', bg: '#000000', color: '#ffffff' }
      },
      {
        type: 'telegram',
        label: 'Написати водію',
        sub: 'Для узгодження поїздки',
        icon: 'M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l3-4'
      }
    ],
    trust: {
      rows: [
        'ФОП зареєстровано, податкову перевірено',
        'Посвідчення водія перевірено',
        'Номер телефону підтверджено'
      ],
      footer: 'На Rahunok з березня 2024 · 640+ переказів без скарг'
    }
  }
};

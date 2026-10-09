<script lang="ts">
  import { Package, AlertTriangle, MapPin, ChartNoAxesColumn, Plug, Settings, Building2, Users, KeyRound, Bell, CreditCard, Globe, Archive, Save, UserPlus, UserCog, Trash2, BookOpen, Plus, ShieldCheck, Calendar, Clock, ArrowUpRight, Mail, Send, Moon, TriangleAlert, Download } from '@lucide/svelte';
  

  // Navigation state
  let currentPath = '/business/settings';

  // Sidebar navigation items
  const navItems = [
    { name: 'Відправлення', path: '/business', icon: Package },
    { name: 'Потребують уваги', path: '/business/attention', badge: 3, icon: AlertTriangle },
    { name: 'Точки отримання', path: '/business/points', icon: MapPin },
    { name: 'Аналітика', path: '/business/analytics', icon: ChartNoAxesColumn },
    { name: 'Інтеграції', path: '/business/integrations', icon: Plug },
    { name: 'Налаштування', path: '/business/settings', icon: Settings }
  ];

  const tabs = [
    { id: 'org', name: 'ОРГАНІЗАЦІЯ', icon: Building2 },
    { id: 'team', name: 'КОМАНДА', icon: Users },
    { id: 'api', name: 'API КЛЮЧІ', icon: KeyRound },
    { id: 'notifications', name: 'СПОВІЩЕННЯ', icon: Bell },
    { id: 'billing', name: 'ТАРИФИ ТА ВИКОРИСТАННЯ', icon: CreditCard }
  ];
  let activeTab = $state('org');

  // Org Data
  let orgData = $state({
    name: 'ТОВ «Ретейл Груп»',
    id: '41235678',
    email: 'contact@retailgroup.com.ua',
    phone: '+380 44 123 45 67',
    timezone: 'Europe/Kyiv',
    language: 'Українська',
    retention: 90
  });

  // Team Data
  let teamMembers = $state([
    { id: 1, name: 'Олександр Коваленко', email: 'o.kovalenko@retailgroup.com.ua', role: 'Власник', status: 'active', lastActive: 'Щойно' },
    { id: 2, name: 'Марія Бойко', email: 'm.boyko@retailgroup.com.ua', role: 'Адмін', status: 'active', lastActive: '2 год тому' },
    { id: 3, name: 'Іван Шевченко', email: 'i.shevchenko@retailgroup.com.ua', role: 'Оператор', status: 'active', lastActive: '1 день тому' },
    { id: 4, name: 'Олена Петренко', email: 'o.petrenko@retailgroup.com.ua', role: 'Розробник', status: 'invited', lastActive: '-' },
    { id: 5, name: 'Сергій Ткаченко', email: 's.tkachenko@retailgroup.com.ua', role: 'Переглядач', status: 'active', lastActive: '3 дні тому' }
  ]);
  
  const roleColors: Record<string, string> = {
    'Власник': 'bg-brand-50 text-brand-700',
    'Адмін': 'bg-purple-50 text-purple-700',
    'Оператор': 'bg-blue-50 text-blue-700',
    'Розробник': 'bg-orange-50 text-orange-700',
    'Переглядач': 'bg-gray-100 text-gray-700'
  };

  // API Keys Data
  let apiKeys = $state([
    { id: 1, name: 'Production Core', prefix: 'rk_live_a3b2...', created: '10.08.2026', lastUsed: 'Сьогодні, 14:32', scopes: ['read', 'write'], active: true },
    { id: 2, name: 'Staging Environment', prefix: 'rk_test_x9y8...', created: '15.08.2026', lastUsed: 'Вчора, 09:15', scopes: ['read', 'write'], active: true },
    { id: 3, name: 'Mobile App ReadOnly', prefix: 'rk_live_c7d4...', created: '01.09.2026', lastUsed: 'Сьогодні, 10:45', scopes: ['read'], active: true },
    { id: 4, name: 'Old Integration', prefix: 'rk_live_f5e6...', created: '12.01.2026', lastUsed: '10.09.2026', scopes: ['read', 'write'], active: false }
  ]);

  // Notifications Data
  let notificationChannels = $state({
    inApp: true,
    email: { active: true, address: 'alerts@retailgroup.com.ua' },
    telegram: { active: false, connected: false },
    webPush: { active: true, permission: 'granted' },
    quietHours: { active: true, start: '21:00', end: '09:00' }
  });

  const notificationEvents = [
    { name: 'Прибуло до відділення', inApp: true, email: true, telegram: false },
    { name: 'Вручено', inApp: true, email: true, telegram: true },
    { name: 'Проблема', inApp: true, email: true, telegram: true },
    { name: 'Не забрано 3 дні', inApp: true, email: true, telegram: false },
    { name: 'Дані застаріли', inApp: true, email: false, telegram: false }
  ];

  // Billing Data
  const plan = {
    name: 'Business',
    limit: 5000,
    used: 2847,
    period: 'Жовтень 2026'
  };
  const usagePercentage = Math.round((plan.used / plan.limit) * 100);

  const invoices = [
    { id: 'INV-2026-10', date: '01.10.2026', amount: '2 500 ₴', status: 'Оплачено' },
    { id: 'INV-2026-09', date: '01.09.2026', amount: '2 500 ₴', status: 'Оплачено' },
    { id: 'INV-2026-08', date: '01.08.2026', amount: '2 500 ₴', status: 'Оплачено' }
  ];
</script>

<div class="flex min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] font-sans selection:bg-brand-500/20 selection:text-brand-700">
  
  <!-- Sidebar -->
  

  <!-- Main Content -->
  <main class="flex-1 flex flex-col min-w-0 overflow-clip bg-[var(--color-surface)]">
    <!-- Header -->
    <header class="h-16 px-5 sm:px-8 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-white flex-shrink-0 z-10 sticky top-0">
      <div class="flex items-center gap-4">
        <h1 class="text-[20px] font-semibold tracking-tight text-[var(--color-text-primary)]">Налаштування</h1>
      </div>
    </header>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-[1320px] mx-auto p-5 sm:p-8">
        
        <!-- Tabs -->
        <div class="flex overflow-x-auto no-scrollbar border-b border-[var(--color-border-subtle)] mb-8">
          {#each tabs as tab}
            <button 
              class="flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap mr-8 last:mr-0 {activeTab === tab.id ? 'border-brand-500 text-brand-700' : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-default)]'}"
              onclick={() => activeTab = tab.id}
            >
              <tab.icon class="w-4 h-4" />
              {tab.name}
            </button>
          {/each}
        </div>

        <!-- 1. ОРГАНІЗАЦІЯ -->
        {#if activeTab === 'org'}
          <div class="space-y-6">
            <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-6 sm:p-8">
              <h2 class="text-[16px] font-semibold mb-6 flex items-center gap-2">
                <Building2 class="w-5 h-5 text-brand-500" size={16} />
                Основна інформація
              </h2>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div class="space-y-2">
                  <label class="text-[13px] font-medium text-[var(--color-text-secondary)]">Назва компанії</label>
                  <input type="text" bind:value={orgData.name} class="w-full bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors" />
                </div>
                
                <div class="space-y-2">
                  <label class="text-[13px] font-medium text-[var(--color-text-secondary)]">Код ЄДРПОУ / ІПН</label>
                  <div class="flex items-center gap-2">
                    <input type="text" bind:value={orgData.id} readonly class="w-full bg-gray-50 border border-[var(--color-border-subtle)] rounded-xl px-4 py-2.5 text-[14px] text-gray-500 focus:outline-none" />
                  </div>
                </div>

                <div class="space-y-2">
                  <label class="text-[13px] font-medium text-[var(--color-text-secondary)]">Контактний Email</label>
                  <input type="email" bind:value={orgData.email} class="w-full bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors" />
                </div>

                <div class="space-y-2">
                  <label class="text-[13px] font-medium text-[var(--color-text-secondary)]">Контактний телефон</label>
                  <input type="text" bind:value={orgData.phone} class="w-full bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors" />
                </div>
              </div>
            </div>

            <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-6 sm:p-8">
              <h2 class="text-[16px] font-semibold mb-6 flex items-center gap-2">
                <Globe class="w-5 h-5 text-brand-500" size={16} />
                Регіональні налаштування
              </h2>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div class="space-y-2">
                  <label class="text-[13px] font-medium text-[var(--color-text-secondary)]">Часовий пояс</label>
                  <select bind:value={orgData.timezone} class="w-full bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors appearance-none">
                    <option value="Europe/Kyiv">Europe/Kyiv (UTC+2/3)</option>
                    <option value="Europe/Warsaw">Europe/Warsaw (UTC+1/2)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                
                <div class="space-y-2">
                  <label class="text-[13px] font-medium text-[var(--color-text-secondary)]">Мова інтерфейсу за замовчуванням</label>
                  <select bind:value={orgData.language} class="w-full bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors appearance-none">
                    <option value="Українська">Українська</option>
                    <option value="English">English</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-6 sm:p-8">
              <h2 class="text-[16px] font-semibold mb-2 flex items-center gap-2">
                <Archive class="w-5 h-5 text-brand-500" size={16} />
                Політика зберігання даних
              </h2>
              <p class="text-[13px] text-[var(--color-text-secondary)] mb-6">Визначте, як довго система повинна зберігати історію ваших відправлень.</p>
              
              <div class="space-y-4">
                <input type="range" min="30" max="365" step="1" bind:value={orgData.retention} class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-600" />
                <div class="flex justify-between text-[12px] text-[var(--color-text-tertiary)] font-medium">
                  <span>30 днів</span>
                  <span>90 днів</span>
                  <span>180 днів</span>
                  <span>365 днів</span>
                </div>
                <div class="text-center mt-4">
                  <span class="inline-flex items-center px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-semibold">
                    {orgData.retention} днів
                  </span>
                </div>
              </div>
            </div>
            
            <div class="flex justify-end gap-3 pt-4">
              <button class="px-5 py-2.5 text-sm font-medium text-[var(--color-text-primary)] bg-white border border-[var(--color-border-default)] rounded-xl hover:bg-gray-50 transition-colors">
                Скасувати зміни
              </button>
              <button class="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl shadow-sm hover:bg-brand-700 transition-colors flex items-center gap-2">
                <Save class="w-4 h-4" size={16} />
                Зберегти налаштування
              </button>
            </div>
          </div>
        {/if}

        <!-- 2. КОМАНДА -->
        {#if activeTab === 'team'}
          <div class="space-y-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-[18px] font-semibold text-[var(--color-text-primary)]">Учасники команди</h2>
                <p class="text-[13px] text-[var(--color-text-secondary)] mt-1">Керуйте доступом до вашого бізнес-акаунту.</p>
              </div>
              <button class="px-4 py-2 bg-brand-600 text-white text-[13px] font-medium rounded-xl hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-sm">
                <UserPlus class="w-4 h-4" size={16} />
                Запросити учасника
              </button>
            </div>

            <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl overflow-clip">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-[var(--color-surface)] border-b border-[var(--color-border-subtle)]">
                    <th class="py-3 px-5 text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Користувач</th>
                    <th class="py-3 px-5 text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Роль</th>
                    <th class="py-3 px-5 text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Статус</th>
                    <th class="py-3 px-5 text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Остання активність</th>
                    <th class="py-3 px-5 text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider text-right">Дії</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--color-border-subtle)]">
                  {#each teamMembers as member}
                    <tr class="hover:bg-gray-50/50 transition-colors">
                      <td class="py-4 px-5">
                        <div class="flex items-center gap-3">
                          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm border border-gray-200">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <div class="text-[14px] font-medium text-[var(--color-text-primary)]">{member.name}</div>
                            <div class="text-[12px] text-[var(--color-text-secondary)]">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td class="py-4 px-5">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium {roleColors[member.role] || 'bg-gray-100 text-gray-700'}">
                          {member.role}
                        </span>
                      </td>
                      <td class="py-4 px-5">
                        {#if member.status === 'active'}
                          <span class="inline-flex items-center gap-1 text-[12px] text-green-700 font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            Активний
                          </span>
                        {:else}
                          <span class="inline-flex items-center gap-1 text-[12px] text-orange-700 font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                            Запрошено
                          </span>
                        {/if}
                      </td>
                      <td class="py-4 px-5 text-[13px] text-[var(--color-text-secondary)]">
                        {member.lastActive}
                      </td>
                      <td class="py-4 px-5 text-right">
                        <div class="flex justify-end gap-2">
                          <button class="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Змінити роль" aria-label="Змінити роль">
                            <UserCog class="w-4 h-4" size={16} />
                          </button>
                          {#if member.role !== 'Власник'}
                            <button class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Видалити" aria-label="Видалити учасника">
                              <Trash2 class="w-4 h-4" size={16} />
                            </button>
                          {/if}
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <div class="bg-brand-50 border border-brand-100 rounded-2xl p-6">
              <h3 class="text-[14px] font-semibold text-brand-800 mb-3 flex items-center gap-2">
                <BookOpen class="w-4 h-4" size={16} />
                Довідник ролей
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                <div class="flex gap-3">
                  <div class="font-medium text-brand-900 w-24 flex-shrink-0">Адмін</div>
                  <div class="text-brand-700/80">Повний доступ до всіх налаштувань, API ключів та білінгу.</div>
                </div>
                <div class="flex gap-3">
                  <div class="font-medium text-brand-900 w-24 flex-shrink-0">Оператор</div>
                  <div class="text-brand-700/80">Керування відправленнями, створення ТТН, перегляд аналітики.</div>
                </div>
                <div class="flex gap-3">
                  <div class="font-medium text-brand-900 w-24 flex-shrink-0">Розробник</div>
                  <div class="text-brand-700/80">Доступ лише до API ключів, вебхуків та документації.</div>
                </div>
                <div class="flex gap-3">
                  <div class="font-medium text-brand-900 w-24 flex-shrink-0">Переглядач</div>
                  <div class="text-brand-700/80">Тільки читання. Може переглядати статистику та статуси.</div>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- 3. API КЛЮЧІ -->
        {#if activeTab === 'api'}
          <div class="space-y-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-[18px] font-semibold text-[var(--color-text-primary)]">Ключі доступу API</h2>
                <p class="text-[13px] text-[var(--color-text-secondary)] mt-1">Використовуйте ці ключі для інтеграції з вашими системами.</p>
              </div>
              <button class="px-4 py-2 bg-brand-600 text-white text-[13px] font-medium rounded-xl hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-sm">
                <Plus class="w-4 h-4" size={16} />
                Створити новий ключ
              </button>
            </div>

            <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-[13px] text-blue-800 mb-6">
              <ShieldCheck class="w-5 h-5 text-blue-600 flex-shrink-0" size={16} />
              <div>
                <p class="font-medium mb-1">Безпека понад усе</p>
                <p class="text-blue-700/80">Повний ключ показується лише один раз при створенні. Зберігайте його в надійному місці. Якщо ви втратили ключ, вам доведеться його відкликати та створити новий.</p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4">
              {#each apiKeys as key}
                <div class="bg-white border {key.active ? 'border-[var(--color-border-subtle)]' : 'border-gray-200 opacity-60'} rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                  <div class="flex items-start gap-4">
                    <div class="w-10 h-10 rounded-xl {key.active ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-500'} flex items-center justify-center flex-shrink-0">
                      <KeyRound class="w-5 h-5" size={16} />
                    </div>
                    <div>
                      <div class="flex items-center gap-2 mb-1">
                        <h3 class="text-[15px] font-semibold text-[var(--color-text-primary)]">{key.name}</h3>
                        {#if !key.active}
                          <span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium uppercase tracking-wider">Відкликано</span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-2 mb-2">
                        <code class="text-[12px] px-2 py-1 bg-gray-100 rounded text-gray-800 font-mono">{key.prefix}••••••••••••</code>
                      </div>
                      <div class="flex items-center gap-4 text-[12px] text-[var(--color-text-tertiary)]">
                        <span class="flex items-center gap-1"><Calendar class="w-3 h-3" size={16} /> Створено: {key.created}</span>
                        <span class="flex items-center gap-1"><Clock class="w-3 h-3" size={16} /> Останній запит: {key.lastUsed}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-3 self-start md:self-auto ml-14 md:ml-0">
                    <div class="flex gap-1 mr-2">
                      {#each key.scopes as scope}
                        <span class="px-2 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border-subtle)] text-[10px] font-medium text-gray-600 uppercase tracking-wider">{scope}</span>
                      {/each}
                    </div>
                    {#if key.active}
                      <button class="px-3 py-1.5 text-[13px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100">
                        Відкликати
                      </button>
                    {:else}
                      <button class="px-3 py-1.5 text-[13px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200">
                        Видалити
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
            
            <div class="mt-8 flex justify-center">
              <a href="#" class="text-[13px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                Переглянути документацію API <ArrowUpRight class="w-3.5 h-3.5" size={16} />
              </a>
            </div>
          </div>
        {/if}

        <!-- 4. СПОВІЩЕННЯ -->
        {#if activeTab === 'notifications'}
          <div class="space-y-6">
            
            <!-- Channels -->
            <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-6">
              <h2 class="text-[16px] font-semibold mb-5">Канали зв'язку</h2>
              
              <div class="space-y-5 divide-y divide-[var(--color-border-subtle)]">
                <!-- In-App -->
                <div class="flex items-start justify-between pt-1">
                  <div class="flex gap-4">
                    <div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                      <Bell class="w-5 h-5" size={16} />
                    </div>
                    <div>
                      <h3 class="text-[14px] font-medium text-[var(--color-text-primary)]">Push-повідомлення в додатку</h3>
                      <p class="text-[13px] text-[var(--color-text-secondary)] mt-0.5">Повідомлення у веб-інтерфейсі та дзвіночку.</p>
                    </div>
                  </div>
                  <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in opacity-50 cursor-not-allowed">
                    <input type="checkbox" checked disabled class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 border-brand-500 appearance-none cursor-not-allowed right-0" style="right: 0;" />
                    <label class="toggle-label block overflow-clip h-5 rounded-full bg-brand-500 cursor-not-allowed"></label>
                  </div>
                </div>

                <!-- Email -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pt-5 gap-4">
                  <div class="flex gap-4">
                    <div class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                      <Mail class="w-5 h-5" size={16} />
                    </div>
                    <div>
                      <h3 class="text-[14px] font-medium text-[var(--color-text-primary)]">Email розсилка</h3>
                      <p class="text-[13px] text-[var(--color-text-secondary)] mt-0.5">Відправка листів на вказану адресу.</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-4 pl-14 sm:pl-0">
                    {#if notificationChannels.email.active}
                      <input type="email" bind:value={notificationChannels.email.address} class="w-48 bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-brand-500" />
                    {/if}
                    <!-- Toggle Switch -->
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" bind:checked={notificationChannels.email.active} class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                    </label>
                  </div>
                </div>

                <!-- Telegram -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between pt-5 gap-4">
                  <div class="flex gap-4">
                    <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Send class="w-5 h-5" size={16} />
                    </div>
                    <div>
                      <h3 class="text-[14px] font-medium text-[var(--color-text-primary)]">Telegram Bot</h3>
                      <p class="text-[13px] text-[var(--color-text-secondary)] mt-0.5">Миттєві сповіщення у ваш Telegram.</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-4 pl-14 sm:pl-0">
                    {#if notificationChannels.telegram.connected}
                       <span class="text-[12px] text-green-600 font-medium">Підключено</span>
                    {:else}
                       <button class="px-3 py-1.5 text-[12px] font-medium text-brand-700 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors">
                         Підключити
                       </button>
                    {/if}
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" bind:checked={notificationChannels.telegram.active} class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quiet Hours -->
            <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-6 flex items-center justify-between">
              <div class="flex gap-4">
                <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Moon class="w-5 h-5" size={16} />
                </div>
                <div>
                  <h3 class="text-[14px] font-medium text-[var(--color-text-primary)]">Тихі години</h3>
                  <p class="text-[13px] text-[var(--color-text-secondary)] mt-0.5">Не надсилати некритичні сповіщення вночі.</p>
                </div>
              </div>
              <div class="flex items-center gap-4">
                {#if notificationChannels.quietHours.active}
                  <div class="flex items-center gap-2 text-[13px]">
                    <input type="time" bind:value={notificationChannels.quietHours.start} class="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-lg px-2 py-1 outline-none" />
                    <span class="text-gray-400">-</span>
                    <input type="time" bind:value={notificationChannels.quietHours.end} class="bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-lg px-2 py-1 outline-none" />
                  </div>
                {/if}
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" bind:checked={notificationChannels.quietHours.active} class="sr-only peer">
                  <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                </label>
              </div>
            </div>

            <!-- Event Matrix -->
            <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl overflow-clip">
              <div class="p-5 border-b border-[var(--color-border-subtle)]">
                <h2 class="text-[16px] font-semibold">Налаштування подій</h2>
                <p class="text-[13px] text-[var(--color-text-secondary)] mt-1">Оберіть, які канали використовувати для різних типів подій.</p>
              </div>
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-[var(--color-surface)] border-b border-[var(--color-border-subtle)]">
                    <th class="py-3 px-5 text-[12px] font-medium text-[var(--color-text-secondary)] w-1/2">Тип події</th>
                    <th class="py-3 px-5 text-[12px] font-medium text-[var(--color-text-secondary)] text-center">В додатку</th>
                    <th class="py-3 px-5 text-[12px] font-medium text-[var(--color-text-secondary)] text-center">Email</th>
                    <th class="py-3 px-5 text-[12px] font-medium text-[var(--color-text-secondary)] text-center">Telegram</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--color-border-subtle)]">
                  {#each notificationEvents as event}
                    <tr class="hover:bg-gray-50/50 transition-colors">
                      <td class="py-3 px-5 text-[13px] font-medium text-[var(--color-text-primary)]">{event.name}</td>
                      <td class="py-3 px-5 text-center">
                        <input type="checkbox" checked={event.inApp} class="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer" />
                      </td>
                      <td class="py-3 px-5 text-center">
                        <input type="checkbox" checked={event.email} class="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer" />
                      </td>
                      <td class="py-3 px-5 text-center">
                        <input type="checkbox" checked={event.telegram} class="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer" />
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <div class="flex justify-end pt-4">
              <button class="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl shadow-sm hover:bg-brand-700 transition-colors flex items-center gap-2">
                <Save class="w-4 h-4" size={16} />
                Зберегти налаштування сповіщень
              </button>
            </div>
          </div>
        {/if}

        <!-- 5. ТАРИФИ ТА ВИКОРИСТАННЯ -->
        {#if activeTab === 'billing'}
          <div class="space-y-6">
            
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- Current Plan Card -->
              <div class="lg:col-span-1 bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 text-white shadow-sm relative overflow-clip">
                <!-- Decorative background elements -->
                <div class="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
                <div class="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-brand-400/20 blur-xl"></div>
                
                <div class="relative z-10">
                  <div class="flex items-center gap-2 mb-4">
                    <span class="px-2.5 py-1 bg-white/20 rounded-lg text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm border border-white/10">Поточний план</span>
                  </div>
                  <h2 class="text-3xl font-bold mb-1 tracking-tight">{plan.name}</h2>
                  <p class="text-brand-100 text-[13px] mb-8">Оптимально для малого та середнього бізнесу.</p>
                  
                  <div class="text-brand-50 text-[13px] mb-2 font-medium flex justify-between">
                    <span>Ліміт відправлень</span>
                    <span>{plan.limit.toLocaleString()} / міс</span>
                  </div>
                  
                  <button class="w-full py-2.5 mt-2 bg-white text-brand-700 text-[14px] font-semibold rounded-xl hover:bg-brand-50 transition-colors shadow-sm">
                    Змінити тариф
                  </button>
                </div>
              </div>

              <!-- Usage Stats -->
              <div class="lg:col-span-2 bg-white border border-[var(--color-border-subtle)] rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h3 class="text-[16px] font-semibold mb-1">Використання ресурсів</h3>
                  <p class="text-[13px] text-[var(--color-text-secondary)] mb-6">Поточний розрахунковий період: <span class="font-medium text-[var(--color-text-primary)]">{plan.period}</span></p>
                  
                  <div class="mb-2 flex justify-between items-end">
                    <div>
                      <span class="text-2xl font-bold text-[var(--color-text-primary)]">{plan.used.toLocaleString()}</span>
                      <span class="text-[14px] text-[var(--color-text-secondary)] ml-1">/ {plan.limit.toLocaleString()} відправлень</span>
                    </div>
                    <span class="text-[14px] font-semibold {usagePercentage > 80 ? 'text-red-600' : 'text-brand-600'}">{usagePercentage}%</span>
                  </div>
                  
                  <div class="w-full h-3 bg-[var(--color-surface)] rounded-full overflow-clip border border-[var(--color-border-default)]">
                    <div 
                      class="h-full rounded-full {usagePercentage > 90 ? 'bg-red-500' : usagePercentage > 75 ? 'bg-orange-500' : 'bg-brand-500'} transition-all duration-500"
                      style="width: {usagePercentage}%"
                    ></div>
                  </div>
                  
                  {#if usagePercentage > 75}
                    <div class="mt-3 flex gap-2 items-start text-[12px] text-orange-700 bg-orange-50 p-2.5 rounded-lg border border-orange-100">
                      <TriangleAlert class="w-4 h-4 flex-shrink-0 mt-0.5" size={16} />
                      <p>Ви наблизились до ліміту тарифного плану. Розгляньте можливість переходу на вищий тариф, щоб уникнути блокування створення нових відправлень.</p>
                    </div>
                  {/if}
                </div>
                
                <div class="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-[var(--color-border-subtle)]">
                  <div>
                    <div class="text-[12px] text-[var(--color-text-secondary)] mb-1">API Запити</div>
                    <div class="font-medium text-[14px]">124,592 <span class="text-[11px] font-normal text-gray-400">/ ∞</span></div>
                  </div>
                  <div>
                    <div class="text-[12px] text-[var(--color-text-secondary)] mb-1">Webhooks</div>
                    <div class="font-medium text-[14px]">8,240 <span class="text-[11px] font-normal text-gray-400">/ ∞</span></div>
                  </div>
                  <div>
                    <div class="text-[12px] text-[var(--color-text-secondary)] mb-1">Сховище документів</div>
                    <div class="font-medium text-[14px]">1.2 GB <span class="text-[11px] font-normal text-gray-400">/ 5 GB</span></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Invoices History -->
            <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl overflow-clip mt-6">
              <div class="p-5 border-b border-[var(--color-border-subtle)] flex justify-between items-center">
                <h3 class="text-[16px] font-semibold">Історія платежів</h3>
                <button class="text-[13px] text-brand-600 hover:text-brand-700 font-medium">Завантажити всі</button>
              </div>
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-[var(--color-surface)] border-b border-[var(--color-border-subtle)]">
                    <th class="py-3 px-5 text-[12px] font-medium text-[var(--color-text-secondary)]">Інвойс</th>
                    <th class="py-3 px-5 text-[12px] font-medium text-[var(--color-text-secondary)]">Дата</th>
                    <th class="py-3 px-5 text-[12px] font-medium text-[var(--color-text-secondary)]">Сума</th>
                    <th class="py-3 px-5 text-[12px] font-medium text-[var(--color-text-secondary)]">Статус</th>
                    <th class="py-3 px-5 text-[12px] font-medium text-[var(--color-text-secondary)] text-right"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--color-border-subtle)]">
                  {#each invoices as invoice}
                    <tr class="hover:bg-gray-50/50 transition-colors">
                      <td class="py-3 px-5 text-[13px] font-medium text-[var(--color-text-primary)]">{invoice.id}</td>
                      <td class="py-3 px-5 text-[13px] text-[var(--color-text-secondary)]">{invoice.date}</td>
                      <td class="py-3 px-5 text-[13px] font-medium">{invoice.amount}</td>
                      <td class="py-3 px-5">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[11px] font-medium border border-green-100">
                          {invoice.status}
                        </span>
                      </td>
                      <td class="py-3 px-5 text-right">
                        <button class="text-[13px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 ml-auto">
                          PDF <Download class="w-3.5 h-3.5" size={16} />
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

          </div>
        {/if}

      </div>
    </div>
  </main>
</div>

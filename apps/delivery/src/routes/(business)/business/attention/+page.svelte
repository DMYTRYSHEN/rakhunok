<script>
    import { Package, AlertTriangle, MapPin, BarChart2, Plug, Settings, Clock, XCircle, RefreshCw, Undo2, ShieldAlert, CreditCard, Lightbulb, UserCheck, MessageCircle, Check } from '@lucide/svelte';
    

    const sidebarItems = [
        { icon: Package, label: 'Відправлення', href: '/business' },
        { icon: AlertTriangle, label: 'Потребують уваги', href: '/business/attention', badge: 3, active: true },
        { icon: MapPin, label: 'Точки отримання', href: '/business/points' },
        { icon: BarChart2, label: 'Аналітика', href: '/business/analytics' },
        { icon: Plug, label: 'Інтеграції', href: '/business/integrations' },
        { icon: Settings, label: 'Налаштування', href: '/business/settings' }
    ];

    const stats = [
        { label: 'Всього', value: 24, type: 'neutral' },
        { label: 'Критичні', value: 3, type: 'critical' },
        { label: 'Нерозподілені', value: 8, type: 'warning' },
        { label: 'Час вирішення', value: '2.4 год', type: 'success' }
    ];

    const filters = ['Всі', 'Термінові', 'Помилки доставки', 'Митниця', 'Затримки'];
    let activeFilter = $state('Всі');

    const attentionItems = [
        {
            id: 1,
            trackingNumber: 'NP-1049582910',
            carrier: 'Нова Пошта',
            priority: 'urgent',
            issueType: 'overdue_pickup',
            issueTitle: 'Прострочений забір',
            issueDesc: 'Відправлення не забрано більше 5 днів',
            timeInState: '5 днів',
            recommendedAction: 'Зв\'язатися з відправником для уточнення актуальності.',
            assignee: { name: 'Олена М.', initials: 'ОМ' },
            icon: Clock
        },
        {
            id: 2,
            trackingNumber: 'ME-99384712',
            carrier: 'Meest',
            priority: 'high',
            issueType: 'delivery_failed',
            issueTitle: 'Невдала спроба доставки',
            issueDesc: 'Клієнт відмовився від отримання або не відповідав',
            timeInState: '4 години',
            recommendedAction: 'Зателефонувати клієнту для узгодження нової дати доставки.',
            assignee: null,
            icon: XCircle
        },
        {
            id: 3,
            trackingNumber: 'UP-29384759',
            carrier: 'Укрпошта',
            priority: 'medium',
            issueType: 'stale_data',
            issueTitle: 'Застарілі дані (API)',
            issueDesc: 'API перевізника не відповідає більше 12 годин',
            timeInState: '14 годин',
            recommendedAction: 'Зачекати оновлення статусу або перевірити на сайті перевізника вручну.',
            assignee: { name: 'Іван К.', initials: 'ІК' },
            icon: RefreshCw
        },
        {
            id: 4,
            trackingNumber: 'NP-5049382711',
            carrier: 'Нова Пошта',
            priority: 'medium',
            issueType: 'return_transit',
            issueTitle: 'Повернення в дорозі',
            issueDesc: 'Відправлення повертається до відправника',
            timeInState: '2 дні',
            recommendedAction: 'Створити заявку на оприходування повернення на склад.',
            assignee: { name: 'Анна В.', initials: 'АВ' },
            icon: Undo2
        },
        {
            id: 5,
            trackingNumber: 'RC-103948572GB',
            carrier: 'Royal Mail',
            priority: 'high',
            issueType: 'customs_hold',
            issueTitle: 'Затримка на митниці',
            issueDesc: 'Потрібні додаткові документи для розмитнення',
            timeInState: '3 дні',
            recommendedAction: 'Запросити інвойс та підтвердження оплати у клієнта.',
            assignee: null,
            icon: ShieldAlert
        },
        {
            id: 6,
            trackingNumber: 'NP-1049582999',
            carrier: 'Нова Пошта',
            priority: 'urgent',
            issueType: 'payment_mismatch',
            issueTitle: 'Невідповідність оплати',
            issueDesc: 'Відправлення видано, але оплата не підтверджена',
            timeInState: '1 година',
            recommendedAction: 'Терміново зв\'язатися з відділенням та фінансовим відділом.',
            assignee: { name: 'Сергій П.', initials: 'СП' },
            icon: CreditCard
        }
    ];
</script>

<div class="flex min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] font-sans">
    <!-- Sidebar -->
    

    <!-- Main Content -->
    <main class="flex-1 overflow-auto">
        <div class="p-5 sm:p-8 max-w-[1320px] mx-auto space-y-8">
            
            <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-[26px] font-bold tracking-tight text-[var(--color-text-primary)]">Потребують уваги</h2>
                    <p class="text-[15px] text-[var(--color-text-secondary)] mt-1">Опрацюйте проблемні відправлення, що потребують втручання.</p>
                </div>
                <button class="bg-[var(--color-brand-600)] hover:bg-[var(--color-brand-700)] text-white px-5 py-2.5 rounded-xl text-[14px] font-medium transition-colors shadow-sm self-start sm:self-auto">
                    Автоматичний розподіл
                </button>
            </header>

            <!-- Stats -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {#each stats as stat}
                    <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-5 flex flex-col justify-between">
                        <span class="text-[14px] font-medium text-[var(--color-text-secondary)]">{stat.label}</span>
                        <div class="mt-2 text-[26px] font-bold tracking-tight {stat.type === 'critical' ? 'text-red-600' : stat.type === 'warning' ? 'text-[var(--color-warning-accent)]' : stat.type === 'success' ? 'text-[var(--color-success-text)]' : 'text-[var(--color-text-primary)]'}">
                            {stat.value}
                        </div>
                    </div>
                {/each}
            </div>

            <!-- Filters -->
            <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {#each filters as filter}
                    <button 
                        class="px-4 py-2 rounded-full text-[14px] font-medium transition-colors whitespace-nowrap {activeFilter === filter ? 'bg-[var(--color-text-primary)] text-white' : 'bg-white border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:text-[var(--color-text-primary)]'}"
                        onclick={() => activeFilter = filter}
                    >
                        {filter}
                    </button>
                {/each}
            </div>

            <!-- Cards -->
            <div class="space-y-4">
                {#each attentionItems as item}
                    <div class="bg-white border border-[var(--color-border-subtle)] rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row gap-6 transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-[var(--color-border-default)]">
                        <!-- Left col: Icon and meta -->
                        <div class="flex gap-4 min-w-[200px]">
                            <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0 
                                {item.priority === 'urgent' ? 'bg-red-50 text-red-600' : item.priority === 'high' ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning-accent)]' : 'bg-[var(--color-brand-50)] text-[var(--color-brand-600)]'}"
                            >
                                <item.icon size={24} strokeWidth={2} />
                            </div>
                            <div>
                                <div class="text-[12px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                                    {item.carrier}
                                </div>
                                <div class="font-mono text-[15px] font-semibold text-[var(--color-text-primary)]">
                                    {item.trackingNumber}
                                </div>
                                <div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                                    <Clock size={16} aria-hidden="true" />
                                    <span>{item.timeInState}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Mid col: Issue details -->
                        <div class="flex-1 flex flex-col justify-center">
                            <h3 class="text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
                                {item.issueTitle}
                                {#if item.priority === 'urgent'}
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700">ТЕРМІНОВО</span>
                                {/if}
                            </h3>
                            <p class="text-[14px] text-[var(--color-text-secondary)] mt-1 mb-3 leading-relaxed">
                                {item.issueDesc}
                            </p>
                            <div class="bg-[var(--color-surface)] rounded-xl p-3 flex gap-3 items-start border border-[var(--color-border-subtle)]">
                                <div class="text-[var(--color-brand-600)] mt-0.5 shrink-0">
                                    <Lightbulb size={16} aria-hidden="true" />
                                </div>
                                <div>
                                    <div class="text-[12px] font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">Рішення</div>
                                    <div class="text-[13px] text-[var(--color-text-secondary)] mt-0.5">{item.recommendedAction}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Right col: Assignee and Actions -->
                        <div class="flex flex-col justify-between min-w-[180px] border-t lg:border-t-0 lg:border-l border-[var(--color-border-subtle)] pt-4 lg:pt-0 lg:pl-6">
                            <div class="flex items-center justify-between mb-4 lg:mb-0">
                                <span class="text-[13px] text-[var(--color-text-secondary)]">Виконавець:</span>
                                {#if item.assignee}
                                    <div class="flex items-center gap-2">
                                        <span class="text-[13px] font-medium text-[var(--color-text-primary)]">{item.assignee.name}</span>
                                        <div class="w-6 h-6 rounded-full bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-700)] text-[10px] font-bold border border-[var(--color-brand-100)]">
                                            {item.assignee.initials}
                                        </div>
                                    </div>
                                {:else}
                                    <span class="text-[13px] italic text-[var(--color-text-tertiary)]">Не призначено</span>
                                {/if}
                            </div>

                            <div class="flex flex-col gap-2">
                                {#if !item.assignee}
                                    <button class="w-full inline-flex items-center justify-center gap-2 bg-[var(--color-brand-50)] hover:bg-[var(--color-brand-100)] text-[var(--color-brand-700)] px-4 py-2 rounded-xl text-[13px] font-medium transition-colors">
                                        <UserCheck size={16} aria-hidden="true" />
                                        Взяти в роботу
                                    </button>
                                {:else}
                                    <button class="w-full inline-flex items-center justify-center gap-2 bg-[var(--color-surface)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] px-4 py-2 rounded-xl text-[13px] font-medium transition-colors">
                                        <MessageCircle size={16} aria-hidden="true" />
                                        Зв'язатися
                                    </button>
                                {/if}
                                <button class="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-border-default)] hover:border-[var(--color-success-accent)] px-4 py-2 rounded-xl text-[13px] font-medium transition-colors">
                                    <Check size={16} aria-hidden="true" />
                                    Вирішено
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

        </div>
    </main>
</div>

<style>
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>

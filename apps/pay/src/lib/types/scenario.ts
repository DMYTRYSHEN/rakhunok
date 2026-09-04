export type ScreenType = 'order' | 'amount' | 'delivery' | 'waiting' | 'table' | string;

export interface DeliveryMethodConfig {
  id: string;
  name: string;
  short: string;
  price: number;
  eta: string;
  addrLabel: string;
  addrPh: string;
}

export interface ScenarioConfig {
  showPromo?: boolean;
  showBreakdown?: boolean;
  promoDiscount?: number;
  ctaText?: string;
  hint?: string;
  currency?: string;
  quickAmounts?: number[];
  showTtlBar?: boolean;
  defaultTtlMinutes?: number;
  waitingTitle?: string;
  waitingSub?: string;
  waitingStatus?: string;
  waitingDetail?: string;
  provider?: string;
  methods?: DeliveryMethodConfig[];
  [key: string]: unknown;
}

export interface ScenarioDefinition {
  id?: string;
  name?: string;
  screen: ScreenType;
  pendingScreen?: ScreenType;
  aliases: string[];
  requiresAmount?: boolean;
  config?: ScenarioConfig;
}

export interface ScenarioCatalog {
  version?: string;
  defaultScenario: string;
  scenarios: Record<string, ScenarioDefinition>;
}

export interface ResolvedScenario extends ScenarioDefinition {
  type: string;
  activeScreen: ScreenType;
}

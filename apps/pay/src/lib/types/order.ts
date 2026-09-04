export interface Merchant {
  display_name?: string;
  business_name?: string;
  iban?: string;
  tax_id?: string;
  phone?: string;
  google_maps_url?: string;
}

export interface Terminal {
  code: string;
  name: string;
}

export interface WaiterDetails {
  name: string;
  photo?: string;
  role?: string;
  caption?: string;
  goal?: string;
  rating?: number;
  presets?: number[];
  percentages?: number[];
}

export interface DonationDetails {
  goal_title: string;
  organizer: string;
  verified?: boolean;
  avatar?: string;
  target_amount: number;
  collected_amount: number;
  currency?: string;
  presets?: number[];
}

export interface FiscalItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  tax_rate?: string;
}

export interface FiscalReceipt {
  fiscal_number: string;
  device_number?: string;
  tax_name: string;
  tax_id: string;
  date_time: string;
  items: FiscalItem[];
  vat_amount?: number;
  total_amount: number;
  qr_code_url?: string;
  verification_url?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  icon?: string;
  note?: string;
}

export interface UpsellItem {
  id: string;
  name: string;
  price: number;
  icon: string;
  category?: string;
}

export interface TrackingStep {
  title: string;
  time: string;
  done: boolean;
  active?: boolean;
}

export interface NovaPoshtaTracking {
  ttn: string;
  sender_city: string;
  recipient_city: string;
  recipient_branch: string;
  status_title: string;
  estimated_delivery: string;
  sender_name?: string;
  weight?: string;
  steps: TrackingStep[];
}

export interface PlatformSplit {
  merchant_amount: number;
  waiter_amount: number;
  charity_amount: number;
  is_compliant: boolean;
}

export interface LoyaltyCard {
  id: string;
  program_name: string;
  card_number: string;
  holder_name: string;
  bonus_balance: number;
  discount_pct?: number;
  tier: string;
  badge_color?: string;
  use_bonuses: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  title?: string;
  type?: string;
  status: 'pending' | 'preparing' | 'paid' | 'cancelled' | 'new' | string;
  base_amount?: number;
  total_amount: number;
  currency?: string;
  table_number?: string | number;
  merchant?: Merchant;
  _terminal?: Terminal;
  created_at?: string;
  createdAt?: string;
  expires_at?: string | null;
  expiresAt?: string | null;
  scenario_config?: Record<string, unknown>;
  scenario?: string;
  waiter?: WaiterDetails;
  donation?: DonationDetails;
  fiscal_receipt?: FiscalReceipt;
  items?: OrderItem[];
  upsells?: UpsellItem[];
  np_tracking?: NovaPoshtaTracking;
  available_bonuses?: number;
  loyalty_card?: LoyaltyCard;
}

export interface DeliveryDetails {
  name: string;
  phone: string;
  method: 'branch' | 'locker' | 'courier' | string;
  city: string;
  branch: string;
  price: number;
}


export interface Bank {
  id?: string;
  name: string;
  code: string;
  bg?: string;
  bg_gradient?: string;
  color?: string;
  logo?: string;
  feePct?: number;
  fee_pct?: number;
  active?: boolean;
  is_active?: boolean;
  routing_mode?: 'redirect' | 'universal_link' | string;
  alias?: string;
}

export interface BankPaymentInitiateResult {
  success: boolean;
  redirect_url?: string;
  fallback_url?: string;
  nbu_raw_string?: string;
  nbu_payload_base64?: string;
  nbu_qr_url?: string;
  error?: string;
}

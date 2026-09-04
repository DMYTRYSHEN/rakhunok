export interface ProfileMetaItem {
  icon: 'pin' | 'clock' | 'star' | 'shield' | 'car' | string;
  text: string;
}

export interface ProfileProduct {
  id: string;
  name: string;
  price: number;
  image: string;
}

export interface ProfileBadge {
  text: string;
  bg: string;
  color: string;
}

export interface ProfileLink {
  type: string;
  label: string;
  sub?: string;
  badge?: ProfileBadge;
  href?: string;
  icon?: string;
}

export interface ProfileQuickPay {
  enabled: boolean;
  label: string;
  presets: number[];
  purpose: string;
}

export interface ProfileTrust {
  rows: string[];
  footer: string;
}

export interface ProfileAvatar {
  type: 'text' | 'image';
  val: string;
  bg: string;
}

export interface ProfileData {
  slug: string;
  type: 'cafe' | 'person' | string;
  name: string;
  description: string;
  verified: boolean;
  handle?: string | null;
  metaItems?: ProfileMetaItem[];
  avatar: ProfileAvatar;
  quickPay: ProfileQuickPay;
  linksTitle?: string;
  links: ProfileLink[];
  products?: ProfileProduct[];
  trust: ProfileTrust;
}

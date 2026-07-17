export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: 'free' | 'creator' | 'business' | 'agency';
  analyses_used: number;
  analyses_limit: number;
  role: 'user' | 'admin'; 
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  created_at: string;
  updated_at: string;
}
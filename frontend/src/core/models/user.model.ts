export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: 'free' | 'creator' | 'agency';
  analyses_used: number;
  analyses_limit: number;
  created_at: string;
}
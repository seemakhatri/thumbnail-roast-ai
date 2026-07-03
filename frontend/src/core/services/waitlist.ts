import { Injectable, inject } from '@angular/core';
import { Supabase } from './supabase';

export interface WaitlistJoinData {
  name?: string;
  email: string;
  role?: string;
  referral_source?: string;
  /** Honeypot — real users never fill this in. If it has a value, silently drop the submission. */
  company_website?: string;
}

export interface WaitlistJoinResult {
  position: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class WaitlistService {
  private supabase = inject(Supabase);

  async join(data: WaitlistJoinData): Promise<{ data: WaitlistJoinResult | null; error: { message: string } | null }> {
    // ── Honeypot: bots fill every field, humans never see this one ──────────
    if (data.company_website) {
      // Pretend success so the bot moves on; don't touch the DB.
      return { data: { position: null }, error: null };
    }

    const { company_website, ...payload } = data;

    const { error: insertError } = await this.supabase.client
      .from('waitlist')
      .insert(payload);

    if (insertError) {
      // 23505 = unique_violation (email already on the list)
      if (insertError.code === '23505') {
        return { data: null, error: { message: "You're already on the waitlist — check your inbox!" } };
      }
      return { data: null, error: { message: 'Something went wrong. Please try again.' } };
    }

    // ── Position: table has no counter column, so we ask Postgres directly. ──
    // Requires the `waitlist_position(text)` RPC — see migration notes.
    try {
      const { data: position } = await this.supabase.client.rpc('waitlist_position', {
        target_email: payload.email,
      });
      return { data: { position: (position as number | null) ?? null }, error: null };
    } catch {
      // Position is a nice-to-have; don't fail the signup if the RPC isn't deployed yet.
      return { data: { position: null }, error: null };
    }
  }
}
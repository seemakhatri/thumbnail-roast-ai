import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supabase } from './supabase';
import { ChannelAudit, ChannelAuditResponse } from '../models/channel-audit.model';

@Injectable({ providedIn: 'root' })
export class ChannelAuditService {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(Supabase);

  private readonly edgeFunctionsUrl = `${environment.supabaseUrl}/functions/v1`;

  readonly loading = signal(false);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly audit = signal<ChannelAudit | null>(null);

  /** Loads the most recent audit (cached if fresh enough), or runs a new
   *  one if none exists yet. Call on page entry. */
  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.audit.set(await this.run(false));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load Channel Audit');
    } finally {
      this.loading.set(false);
    }
  }

  /** Forces a brand-new audit run, ignoring the cache. */
  async refresh(): Promise<void> {
    this.refreshing.set(true);
    this.error.set(null);
    try {
      this.audit.set(await this.run(true));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to refresh Channel Audit');
    } finally {
      this.refreshing.set(false);
    }
  }

  private async run(force: boolean): Promise<ChannelAudit> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Please sign in to use the AI Channel Audit.');

    try {
      const response = await firstValueFrom(
        this.http.post<ChannelAuditResponse>(
          `${this.edgeFunctionsUrl}/channel-audit`,
          { force },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabaseAnonKey,
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      if (!response.success || !response.audit) {
        throw new Error('Invalid response from Channel Audit');
      }

      return response.audit;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        const serverMessage = error.error?.error as string | undefined;

        if (error.status === 402) {
          throw new Error(serverMessage ?? 'Channel Audit requires a Creator plan or higher.');
        }
        if (error.status === 422) {
          throw new Error(serverMessage ?? 'Sync more videos from your YouTube account first.');
        }
        if (error.status === 429) {
          throw new Error(serverMessage ?? 'Monthly Channel Audit limit reached.');
        }

        throw new Error(serverMessage ?? `Server error (${error.status})`);
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Channel Audit failed. Please try again.');
    }
  }
}
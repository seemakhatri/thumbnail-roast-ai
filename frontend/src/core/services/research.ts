import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supabase } from './supabase';
import { ResearchMode, ResearchResponse, ResearchSession } from '../models/research.model';

@Injectable({
  providedIn: 'root',
})
export class Research {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(Supabase);

  private readonly edgeFunctionsUrl = `${environment.supabaseUrl}/functions/v1`;

  /**
   * Runs a Research Engine pass for a channel, niche, or keyword.
   * Requires an authenticated, paid-plan user — the edge function
   * enforces the plan/usage gate server-side.
   */
  async run(mode: ResearchMode, input: string): Promise<ResearchSession> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Please sign in to use the Research Engine.');

    try {
      const response = await firstValueFrom(
        this.http.post<ResearchResponse>(
          `${this.edgeFunctionsUrl}/research`,
          { mode, input },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabaseAnonKey,
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      if (!response.success || !response.session) {
        throw new Error('Invalid response from Research Engine');
      }

      return response.session;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        const serverMessage = error.error?.error as string | undefined;

        if (error.status === 402) {
          throw new Error(
            serverMessage ?? 'Research Engine requires a Creator plan or higher.',
          );
        }
        if (error.status === 429) {
          throw new Error(serverMessage ?? 'Monthly research limit reached.');
        }
        if (error.status === 400) {
          throw new Error(serverMessage ?? 'Invalid input.');
        }

        throw new Error(serverMessage ?? `Server error (${error.status})`);
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Research run failed. Please try again.');
    }
  }
}

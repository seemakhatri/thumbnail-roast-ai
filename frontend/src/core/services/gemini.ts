import { inject, Injectable } from '@angular/core';
import { ThumbnailReport } from '../models/report.model';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supabase } from './supabase';
import {
  ComparisonResponse,
  CtrCorrelationResponse,
  DashboardData,
} from '../models/dashboard.model';

interface AnalyzeResponse {
  success: boolean;
  report: ThumbnailReport;
}

@Injectable({
  providedIn: 'root',
})
export class Gemini {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(Supabase);

  /** Base URL for all Supabase Edge Functions */
  private readonly edgeFunctionsUrl = `${environment.supabaseUrl}/functions/v1`;

  /**
   * Sends the image URL to the Edge Function for analysis.
   * Returns the full saved ThumbnailReport on success.
   *
   * @param imageUrl  — Public Supabase Storage URL of the uploaded thumbnail
   * @param userId    — Optional. Pass for authenticated users for usage tracking
   */
  async analyze(imageUrl: string): Promise<ThumbnailReport> {
    try {
      const {
        data: { session },
      } = await this.supabase.client.auth.getSession();

      const accessToken = session?.access_token;

      console.log('JWT exists:', !!accessToken);

      const response = await firstValueFrom(
        this.http.post<AnalyzeResponse>(
          `${this.edgeFunctionsUrl}/analyze-thumbnail`,
          { imageUrl },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: environment.supabaseAnonKey,
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
          },
        ),
      );

      if (!response.success || !response.report) {
        throw new Error('Invalid response from analysis service');
      }

      return response.report;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        // Parse structured error from Edge Function
        const serverMessage = error.error?.error as string | undefined;

        if (error.status === 429) {
          throw new Error(serverMessage ?? 'Analysis limit reached. Please upgrade your plan.');
        }
        if (error.status === 502) {
          throw new Error(
            serverMessage ?? 'AI analysis temporarily unavailable. Please try again.',
          );
        }
        if (error.status === 400) {
          throw new Error(serverMessage ?? 'Invalid image URL.');
        }

        throw new Error(serverMessage ?? `Server error (${error.status})`);
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Analysis failed. Please try again.');
    }
  }

  /**
   * Fetches a public report by share slug.
   * Used on the /report/:slug page.
   */
  async getReportBySlug(slug: string): Promise<ThumbnailReport> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ report: ThumbnailReport }>(
          `${this.edgeFunctionsUrl}/get-report?slug=${slug}`,
          {
            headers: {
              Authorization: `Bearer ${environment.supabaseAnonKey}`,
              apikey: environment.supabaseAnonKey,
            },
          },
        ),
      );

      return response.report;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        throw new Error('Report not found. The link may have expired.');
      }
      throw new Error('Failed to load report.');
    }
  }

  // ADD these methods to your existing Gemini service class

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboard(): Promise<DashboardData> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Not signed in');

    const response = await firstValueFrom(
      this.http.get<DashboardData>(`${this.edgeFunctionsUrl}/dashboard`, {
        headers: {
          apikey: environment.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
      }),
    );
    return response;
  }

  async compareThumbnails(idA: string, idB: string, idC?: string): Promise<ComparisonResponse> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Not signed in');

    const response = await firstValueFrom(
      this.http.post<ComparisonResponse>(
        `${this.edgeFunctionsUrl}/compare-thumbnails`,
        { thumbnailA: idA, thumbnailB: idB, thumbnailC: idC ?? null },
        {
          headers: {
            'Content-Type': 'application/json',
            apikey: environment.supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
        },
      ),
    );
    return response;
  }

  async getCtrCorrelation(): Promise<CtrCorrelationResponse> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Not signed in');

    const response = await firstValueFrom(
      this.http.get<CtrCorrelationResponse>(`${this.edgeFunctionsUrl}/ctr-correlation`, {
        headers: {
          apikey: environment.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
      }),
    );
    return response;
  }
}

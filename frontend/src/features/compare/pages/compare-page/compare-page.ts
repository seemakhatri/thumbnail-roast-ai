import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Zap,
  BarChart3,
  Target,
  Rocket,
  Search,
  AlertCircle,
  Flame,
  Plus,
  X,
} from 'lucide-angular';
import { CompareService } from '../../../../core/services/compare';
import { ThumbnailReport } from '../../../../core/models/report.model';
import { ReportPicker } from '../../components/report-picker/report-picker';
import { CompareResult } from '../../components/compare-result/compare-result';
import { Supabase } from '../../../../core/services/supabase';

@Component({
  selector: 'app-compare-page',
  standalone: true,
  imports: [RouterLink, ReportPicker, CompareResult, LucideAngularModule],
  templateUrl: './compare-page.html',
  styleUrl: './compare-page.scss',
})
export class ComparePage {
  readonly compareService = inject(CompareService);
  readonly supabase = inject(Supabase);

  readonly icons = {
    zap: Zap,
    barChart: BarChart3,
    target: Target,
    rocket: Rocket,
    search: Search,
    alertCircle: AlertCircle,
    flame: Flame,
    plus: Plus,
    x: X,
  };

  // Exclude already-selected thumbnails from other pickers
  readonly excludeFromB = computed(() => {
    const a = this.compareService.slotA();
    const c = this.compareService.slotC();
    return [a?.id, c?.id].filter(Boolean) as string[];
  });

  readonly excludeFromA = computed(() => {
    const b = this.compareService.slotB();
    const c = this.compareService.slotC();
    return [b?.id, c?.id].filter(Boolean) as string[];
  });

  readonly excludeFromC = computed(() => {
    const a = this.compareService.slotA();
    const b = this.compareService.slotB();
    return [a?.id, b?.id].filter(Boolean) as string[];
  });

  // Show/hide optional 3rd slot
  readonly showSlotC = signal(false);

  // Track if user has seen the onboarding
  readonly hasVisitedBefore = signal(false);

  // Handle slot selections
  onPickedA(report: ThumbnailReport | null): void {
    this.compareService.slotA.set(report);
    if (report) this.hasVisitedBefore.set(true);
  }

  onPickedB(report: ThumbnailReport | null): void {
    this.compareService.slotB.set(report);
    if (report) this.hasVisitedBefore.set(true);
  }

  onPickedC(report: ThumbnailReport | null): void {
    this.compareService.slotC.set(report);
    if (report) this.hasVisitedBefore.set(true);
  }

  // Add/remove third comparison slot
  addThird(): void {
    this.showSlotC.set(true);
  }

  removeThird(): void {
    this.showSlotC.set(false);
    this.compareService.slotC.set(null);
  }

  // Run comparison
  async run(): Promise<void> {
    await this.compareService.compare();
  }

  // Reset everything
  reset(): void {
    this.compareService.reset();
    this.showSlotC.set(false);
    this.hasVisitedBefore.set(false);
  }
}
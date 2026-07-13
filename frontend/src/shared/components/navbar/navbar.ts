import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Supabase } from '../../../core/services/supabase';
import {
  LayoutDashboard,
  Flame,
  SquareChartGantt,
  LogOut,
  LucideAngularModule,
  Sun,
  Moon,
  Lock
} from 'lucide-angular';
import { ThemeService } from '../../../core/services/theme';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  readonly supabase = inject(Supabase);
  private router = inject(Router);

  readonly scrolled = signal(false);
  readonly mobileOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly theme = inject(ThemeService);

  readonly icons = {
    dashboard: LayoutDashboard,
    flame: Flame,
    compare: SquareChartGantt,
    logout: LogOut,
    sun: Sun,
    moon: Moon,
    lock: Lock
  };

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 20);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (!target.closest('.nb__user')) {
      this.userMenuOpen.set(false);
    }
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }
  closeMobile(): void {
    this.mobileOpen.set(false);
  }
  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }
  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  firstName(): string {
    const name = this.supabase.currentUser()?.full_name;
    return name ? name.split(' ')[0] : 'Account';
  }

  initials(): string {
    const name = this.supabase.currentUser()?.full_name ?? '';
    return (
      name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?'
    );
  }

  navigateToHome(fragment?: string): void {
    this.closeMobile();
    if (this.router.url === '/') {
      if (fragment) {
        setTimeout(() => {
          const element = document.getElementById(fragment);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    } else {
      this.router.navigate(['/'], { fragment });
    }
  }

  async signOut(): Promise<void> {
    this.closeUserMenu();
    this.closeMobile();
    await this.supabase.signOut();
  }

  toggleTheme(): void {
  this.theme.toggle();
}

readonly canCompare = computed(() => {
  const plan = this.supabase.userPlan();
  return plan !== 'free' && plan !== undefined; 
});
}

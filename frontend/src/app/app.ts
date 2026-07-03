import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Navbar } from '../shared/components/navbar/navbar';
import { Footer } from '../shared/components/footer/footer';
import { ToastContainer } from '../shared/components/toast/toast';
import { signal } from '@angular/core';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private router = inject(Router);
  
  // Use signal for reactivity
  readonly isWaitlistPage = signal(false);

  constructor() {
    // Track route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Hide navbar/footer on waitlist page and root (which shows waitlist)
      this.isWaitlistPage.set(
        event.url === '/waitlist' || 
        event.url === '/' ||
        event.url.startsWith('/waitlist')
      );
    });
  }
}
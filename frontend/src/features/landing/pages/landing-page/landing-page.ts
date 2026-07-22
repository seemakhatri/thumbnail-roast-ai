import { AfterViewInit, Component, inject } from '@angular/core';
import { HeroSection } from '../../components/hero-section/hero-section';
import { UploadSection } from '../../../analyze/components/upload-section/upload-section';
import { CtaSection } from '../../components/cta-section/cta-section';
import { FaqSection } from '../../components/faq-section/faq-section';
import { FeaturesSection } from '../../components/features-section/features-section';
import { PricingSection } from '../../components/pricing-section/pricing-section';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  imports: [
    HeroSection,
    UploadSection,
    FeaturesSection,
    PricingSection,
    FaqSection,
    CtaSection,
  ],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
})
export class LandingPage implements AfterViewInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngAfterViewInit(): void {
    this.route.fragment.subscribe((fragment) => {
      if (fragment) {
        setTimeout(() => {
          const element = document.getElementById(fragment);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    });
  }

  scrollToAnalyze(): void {
    document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
  }
}
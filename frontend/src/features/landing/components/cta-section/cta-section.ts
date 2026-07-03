import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-cta-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cta-section.html',
  styleUrl: './cta-section.scss',
})
export class CtaSection {

  // Floating decorative score cards — purely visual
  readonly scoreCards = [
    { label: 'Contrast',    score: 80, color: 'green'  },
    { label: 'Emotion',     score: 45, color: 'yellow' },
    { label: 'Readability', score: 30, color: 'red'    },
    { label: 'CTR Score',   score: 65, color: 'blue'   },
  ];

  scrollToAnalyze(): void {
    document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
  }
}
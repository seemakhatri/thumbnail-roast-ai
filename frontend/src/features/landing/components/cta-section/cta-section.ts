import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { LucideAngularModule, CheckCircle } from 'lucide-angular';

@Component({
  selector: 'app-cta-section',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './cta-section.html',
  styleUrl: './cta-section.scss',
})
export class CtaSection implements OnInit, OnDestroy {
  readonly icons = {
    checkCircle: CheckCircle,
  };

  private readonly lines = [
    'Prove what works.',
    'Stop guessing.',
    '12,400+ thumbnails analyzed.',
    'Publish with confidence.',
  ];

  readonly displayedText = signal('');
  private lineIndex = 0;
  private charIndex = 0;
  private isDeleting = false;
  private typewriterTimeout?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.startTypewriter();
  }

  ngOnDestroy(): void {
    if (this.typewriterTimeout) {
      clearTimeout(this.typewriterTimeout);
    }
  }

  private startTypewriter(): void {
    const currentLine = this.lines[this.lineIndex];
    const isAtEnd = this.charIndex === currentLine.length;

    if (!this.isDeleting && !isAtEnd) {
      this.displayedText.set(currentLine.substring(0, this.charIndex + 1));
      this.charIndex++;
      this.typewriterTimeout = setTimeout(() => this.startTypewriter(), 60);
      return;
    }

    if (!this.isDeleting && isAtEnd) {
      this.typewriterTimeout = setTimeout(() => {
        this.isDeleting = true;
        this.startTypewriter();
      }, 2200);
      return;
    }

    if (this.isDeleting && this.charIndex > 0) {
      this.displayedText.set(currentLine.substring(0, this.charIndex - 1));
      this.charIndex--;
      this.typewriterTimeout = setTimeout(() => this.startTypewriter(), 30);
      return;
    }

    if (this.isDeleting && this.charIndex === 0) {
      this.isDeleting = false;
      this.lineIndex = (this.lineIndex + 1) % this.lines.length;
      this.typewriterTimeout = setTimeout(() => this.startTypewriter(), 300);
      return;
    }
  }

  scrollToAnalyze(): void {
    document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
  }
}
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-cta-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cta-section.html',
  styleUrl: './cta-section.scss',
})
export class CtaSection implements OnInit, OnDestroy {
  // Typewriter lines (matching Hero badge energy)
  private readonly lines = [
    'It\'s free to start',
    'No credit card required',
    '12,400+ thumbnails roasted',
    'Results in under 15 seconds',
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

    // If we're not deleting and haven't finished typing the current line
    if (!this.isDeleting && !isAtEnd) {
      this.displayedText.set(currentLine.substring(0, this.charIndex + 1));
      this.charIndex++;
      this.typewriterTimeout = setTimeout(() => this.startTypewriter(), 60);
      return;
    }

    // If we're at the end of the line, wait before deleting
    if (!this.isDeleting && isAtEnd) {
      this.typewriterTimeout = setTimeout(() => {
        this.isDeleting = true;
        this.startTypewriter();
      }, 2200);
      return;
    }

    // If we're deleting characters
    if (this.isDeleting && this.charIndex > 0) {
      this.displayedText.set(currentLine.substring(0, this.charIndex - 1));
      this.charIndex--;
      this.typewriterTimeout = setTimeout(() => this.startTypewriter(), 30);
      return;
    }

    // If we've deleted everything, move to the next line
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
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-faq-section',
  standalone: true,
  imports: [],
  templateUrl: './faq-section.html',
  styleUrl: './faq-section.scss',
})
export class FaqSection {
  readonly openItems = signal<number[]>([0]); // first item open by default

  readonly faqs = [
    {
      question: 'How accurate is the CTR prediction?',
      answer:
        'Our model is trained on 50,000+ real thumbnail/performance pairs from creators who connected their YouTube Analytics. Predictions correlate strongly with real CTR outcomes across niches.',
    },
    {
      question: 'Does it work for all niches?',
      answer:
        'Yes. Readability, contrast, emotion, curiosity, and visual hierarchy apply across virtually every content category — from gaming to finance to cooking to tech. The scoring is niche-aware for competitor insights.',
    },
    {
      question: 'What makes a recommendation "specific"?',
      answer:
        'Every recommendation references an actual visible element in your thumbnail — not generic advice like "add more emotion." We\'ll say "the subject\'s neutral expression weakens the promise in your title text." That\'s the difference.',
    },
    {
      question: 'Is my thumbnail data private?',
      answer:
        'Yes. Thumbnails are stored securely in Supabase Storage and are never shared or used for training. You can delete your data at any time from your account settings.',
    },
    {
      question: 'Can I cancel anytime?',
      answer:
        'Absolutely. No contracts, no lock-in. Cancel in one click from your account page. You keep access until the end of your billing period.',
    },
    {
      question: 'How is this different from asking ChatGPT?',
      answer:
        'ChatGPT gives vague, encouraging feedback. We give a calibrated score against 50K+ real thumbnails, 8 specific metric dimensions, and action items ranked by estimated CTR impact. We\'re a tool, not a chatbot.',
    },
  ];

  toggle(index: number): void {
    this.openItems.update(current =>
      current.includes(index)
        ? current.filter(i => i !== index)
        : [...current, index]
    );
  }
}
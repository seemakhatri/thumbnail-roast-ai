import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { WaitlistService } from '../../core/services/waitlist';
import { Supabase } from '../../core/services/supabase';
import {
  Flame,
  Upload,
  Zap,
  CheckCircle,
  Target,
  Brain,
  Lightbulb,
  Trophy,
  BarChart3,
  SquareChartGantt,
  Youtube,
  Sparkles,
  Lock,
  Gift,
  ArrowRight,
  Smartphone,
  TrendingUp,
  BookOpen,
  Share2,
  Copy,
  Check,
  Users,
  Clock,
  ChevronDown,
  Star,
  LucideAngularModule,
} from 'lucide-angular';
import { RouterLink } from '@angular/router';

interface FeedItem {
  name: string;
  detail: string;
  timeAgo: string;
}

@Component({
  selector: 'app-waitlist',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, RouterLink],
  templateUrl: './waitlist.html',
  styleUrl: './waitlist.scss',
})
export class Waitlist implements OnInit {
  private fb = inject(FormBuilder);
  private waitlistService = inject(WaitlistService);
  private supabase = inject(Supabase);

  readonly icons = {
    flame: Flame,
    upload: Upload,
    zap: Zap,
    checkCircle: CheckCircle,
    target: Target,
    brain: Brain,
    lightbulb: Lightbulb,
    trophy: Trophy,
    barChart: BarChart3,
    compare: SquareChartGantt,
    youtube: Youtube,
    sparkles: Sparkles,
    lock: Lock,
    gift: Gift,
    arrowRight: ArrowRight,
    smartphone: Smartphone,
    trendingUp: TrendingUp,
    bookOpen: BookOpen,
    share: Share2,
    copy: Copy,
    check: Check,
    users: Users,
    clock: Clock,
    chevronDown: ChevronDown,
    star: Star,
  };

  // ── form state ─────────────────────────────────────────────────────────
  loading = false;
  joined = false;
  error = '';
  readonly position = signal<number | null>(null);

  // ── social proof (real count, falls back to a sane default) ────────────
  readonly waitlistCount = signal<number>(847);
  readonly openFaq = signal<number | null>(null);

  form = this.fb.nonNullable.group({
    name: '',
    email: ['', [Validators.required, Validators.email]],
    role: '',
    referral_source: '',
    company_website: '',
  });

  async ngOnInit(): Promise<void> {
    try {
      const { data } = await this.supabase.client.rpc('waitlist_count');
      if (typeof data === 'number' && data > 0) {
        this.waitlistCount.set(data);
      }
    } catch {
      // RPC not deployed yet — keep the fallback number, no user-facing error.
    }
  }

  async joinWaitlist(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Please enter a valid email address.';
      return;
    }

    this.loading = true;
    this.error = '';

    const { data, error } = await this.waitlistService.join(this.form.getRawValue());

    this.loading = false;

    if (error) {
      this.error = error.message;
      return;
    }

    this.position.set(data?.position ?? null);
    this.waitlistCount.update((n) => n + 1);
    this.joined = true;
  }

  scrollToForm(): void {
    document.getElementById('join-waitlist')?.scrollIntoView({ behavior: 'smooth' });
  }

  copyLink(): void {
    navigator.clipboard?.writeText('https://thumbnailroast.com');
  }

  shareOnX(): void {
    const text = encodeURIComponent(
      `I just joined the ThumbnailRoast waitlist 🔥 AI tells you exactly why your thumbnail isn't getting clicks.`,
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=https://thumbnailroast.com`,
      '_blank',
    );
  }

  toggleFaq(i: number): void {
    this.openFaq.update((cur) => (cur === i ? null : i));
  }

  // ── content data ───────────────────────────────────────────────────────
  readonly steps = [
    {
      num: '1',
      icon: this.icons.upload,
      title: 'Upload your thumbnail',
      desc: 'Drag & drop or click to upload. JPG, PNG, or WEBP — no account needed.',
    },
    {
      num: '2',
      icon: this.icons.zap,
      title: 'AI roasts it in ~15 seconds',
      desc: 'Vision AI scores 8 dimensions and writes a brutal, specific critique.',
    },
    {
      num: '3',
      icon: this.icons.checkCircle,
      title: 'Fix what actually matters',
      desc: 'Three prioritized recommendations, ranked by estimated CTR impact.',
    },
  ];

  readonly features = [
    {
      icon: this.icons.target,
      name: 'CTR Prediction Engine',
      desc: 'Predicts click-through rate before the video goes live, from the thumbnail alone.',
      bg: 'rgba(255,77,0,0.1)',
      border: 'rgba(255,77,0,0.2)',
      badge: '',
    },
    {
      icon: this.icons.brain,
      name: '8-Dimension Scoring',
      desc: 'CTR potential, emotion, curiosity, readability, contrast, mobile visibility, face impact, branding.',
      bg: 'rgba(168,85,247,0.1)',
      border: 'rgba(168,85,247,0.2)',
      badge: '',
    },
    {
      icon: this.icons.lightbulb,
      name: 'Instant Recommendations',
      desc: 'Specific fixes, not generic advice — each one names the exact element to change.',
      bg: 'rgba(34,197,94,0.1)',
      border: 'rgba(34,197,94,0.2)',
      badge: '',
    },
    {
      icon: this.icons.compare,
      name: 'Head-to-Head Compare',
      desc: 'Put two or three thumbnails side by side and get a data-backed winner, not a guess.',
      bg: 'rgba(59,130,246,0.1)',
      border: 'rgba(59,130,246,0.2)',
      badge: '',
    },
    {
      icon: this.icons.youtube,
      name: 'YouTube Sync',
      desc: 'Connect your channel to see predicted score next to your real, measured CTR.',
      bg: 'rgba(239,68,68,0.1)',
      border: 'rgba(239,68,68,0.2)',
      badge: '',
    },
    {
      icon: this.icons.trophy,
      name: 'Competitor Intelligence',
      desc: 'See what top-performing thumbnails in your niche do differently — and beat them.',
      bg: 'rgba(234,179,8,0.1)',
      border: 'rgba(234,179,8,0.2)',
      badge: 'Coming soon',
    },
  ];

  readonly metrics = [
    'CTR Potential',
    'Readability',
    'Emotion',
    'Curiosity',
    'Mobile Score',
    'Contrast',
    'Face Quality',
    'Branding',
  ];

  readonly plans = [
    { name: 'Free', price: '0', tag: '3 roasts / mo', featured: false },
    { name: 'Creator', price: '19', tag: '50 roasts / mo', featured: true },
    { name: 'Business', price: '49', tag: '200 roasts / mo', featured: false },
    { name: 'Agency', price: '79', tag: '500 roasts / mo · 5 seats', featured: false },
  ];

  // ── compare showcase data (mirrors the real /compare result screen) ────
  readonly compareLeft = {
    label: 'Beautiful Art, Weak Text',
    score: 88,
    verdict: 'Strong',
    metrics: [
      { name: 'Face', value: 62 },
      { name: 'Text', value: 41 },
      { name: 'Curiosity', value: 88 },
      { name: 'Emotion', value: 79 },
      { name: 'Contrast', value: 91 },
      { name: 'Brand', value: 70 },
    ],
  };
  readonly compareRight = {
    label: 'Pleasant Art, Lacking Hook',
    score: 49,
    verdict: 'Decent',
    metrics: [
      { name: 'Face', value: 20 },
      { name: 'Text', value: 30 },
      { name: 'Curiosity', value: 38 },
      { name: 'Emotion', value: 45 },
      { name: 'Contrast', value: 66 },
      { name: 'Brand', value: 40 },
    ],
  };

  readonly faqs = [
    {
      q: 'Is it really free to join?',
      a: 'Yes. Joining the waitlist costs nothing, and every account starts on the Free plan with 3 roasts a month — no card required.',
    },
    {
      q: 'When do I get access?',
      a: "We're opening spots in small batches so the AI scoring holds up under load. The sooner you join, the sooner your invite lands — sharing your link moves you up the queue.",
    },
    {
      q: 'What can I compare?',
      a: 'Any two or three of your past roasts. We score all of them on the same 8 dimensions and call a data-backed winner — no more guessing which thumbnail to publish.',
    },
    {
      q: 'Does it work with my existing channel?',
      a: "Yes — once you're in, you can connect YouTube to sync your real CTR against our predicted scores and see which threshold actually drives clicks for your channel.",
    },
  ];
}

import { Component } from '@angular/core';
import {
  Upload,
  Zap,
  CheckCircle,
  Target,
  Brain,
  Lightbulb,
  Trophy,
  BarChart3,
  Flame,
  LucideAngularModule,
} from 'lucide-angular';

@Component({
  selector: 'app-features-section',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './features-section.html',
  styleUrl: './features-section.scss',
})
export class FeaturesSection {
  readonly steps = [
    {
      num: '1',
      icon: Upload,
      title: 'Upload your thumbnail',
      desc: 'Drag & drop or click to upload. JPG, PNG, or WEBP. No account needed.',
    },
    {
      num: '2',
      icon: Zap,
      title: 'AI roasts it in 15 seconds',
      desc: 'Gemini Vision scores 8 dimensions and generates a brutal, specific critique.',
    },
    {
      num: '3',
      icon: CheckCircle,
      title: 'Fix what actually matters',
      desc: 'Three prioritized recommendations — ranked by estimated CTR impact.',
    },
  ];

readonly features = [
  {
    icon: Target,
    name: 'CTR Prediction Engine',
    desc: 'Trained on 50K+ thumbnail / performance pairs. Predicts click-through rate before the video goes live.',
    badge: '',
  },
  {
    icon: Brain,
    name: '8-Dimension Scoring',
    desc: 'CTR potential, emotion, curiosity, readability, contrast, mobile visibility, face impact, brand consistency.',
    badge: '',
  },
  {
    icon: Lightbulb,
    name: 'Instant Recommendations',
    desc: 'Specific fixes, not generic advice. Each recommendation references the exact visual element to change.',
    badge: '',
  },
  {
    icon: Trophy,
    name: 'Competitor Intelligence',
    desc: 'See what top creators in your niche do differently — faces, colors, text patterns, emotional hooks.',
    badge: '',
  },
  {
    icon: BarChart3,
    name: 'Historical Tracking',
    desc: "Compare every thumbnail you've made. See your improvement trend over time.",
    badge: 'Creator+',
  },
  {
    icon: Flame,
    name: 'Shareable Roast Reports',
    desc: 'Every analysis generates a public share card. Post your score, tag us, grow the product.',
    badge: '',
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
}
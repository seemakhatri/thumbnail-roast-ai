import { Component } from '@angular/core';
import { LucideAngularModule, Sparkle } from 'lucide-angular';

@Component({
  selector: 'app-upgrade-banner-slim',
  imports: [LucideAngularModule],
  templateUrl: './upgrade-banner-slim.html',
  styleUrl: './upgrade-banner-slim.scss',
})
export class UpgradeBannerSlim {

    readonly icons = {
    sparkles: Sparkle
  };


}

import { Component } from '@angular/core';
import { LegalLayout } from '../../../../shared/components/legal-layout/legal-layout';

@Component({
  selector: 'app-privacy-page',
  imports: [LegalLayout],
  templateUrl: './privacy-page.html',
  styleUrl: './privacy-page.scss',
})
export class PrivacyPage {
 readonly lastUpdated = 'June 27, 2026';
}

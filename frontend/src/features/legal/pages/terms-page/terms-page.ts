import { Component } from '@angular/core';
import { LegalLayout } from '../../../../shared/components/legal-layout/legal-layout';

@Component({
  selector: 'app-terms-page',
  imports: [LegalLayout],
  templateUrl: './terms-page.html',
  styleUrl: './terms-page.scss',
})
export class TermsPage {
 readonly lastUpdated = 'June 27, 2026';
}

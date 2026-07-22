import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, SearchX, ArrowRight, Home } from 'lucide-angular';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './not-found-page.html',
  styleUrl: './not-found-page.scss',
})
export class NotFoundPage {
  readonly icons = { searchX: SearchX, arrowRight: ArrowRight, home: Home };
}
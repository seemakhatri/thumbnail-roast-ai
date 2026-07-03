import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Footer } from '../footer/footer';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-legal-layout',
  imports: [CommonModule],
  templateUrl: './legal-layout.html',
  styleUrl: './legal-layout.scss',
})
export class LegalLayout {
  @Input() title = '';
  @Input() lastUpdated = '';
}

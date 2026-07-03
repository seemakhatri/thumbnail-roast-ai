import { Component, input } from '@angular/core';

@Component({
  selector: 'app-thumbnail-preview',
  imports: [],
  templateUrl: './thumbnail-preview.html',
  styleUrl: './thumbnail-preview.scss',
})
export class ThumbnailPreview {
  readonly imageUrl = input.required<string>();
}

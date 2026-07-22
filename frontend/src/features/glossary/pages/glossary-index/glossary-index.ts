import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GlossaryService, GlossaryTerm } from '../../../../core/services/glossary';
import { MetaService } from '../../../../core/services/meta';
import { SchemaService } from '../../../../core/services/schema';

@Component({
  selector: 'app-glossary-index',
  imports: [RouterLink],
  templateUrl: './glossary-index.html',
  styleUrl: './glossary-index.scss',
})
export class GlossaryIndex implements OnInit {
  private readonly glossaryService = inject(GlossaryService);
  private readonly meta = inject(MetaService);
  private readonly schema = inject(SchemaService);

  readonly terms = signal<GlossaryTerm[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly activeLetter = signal<string | null>(null);

  readonly letters = computed(() => {
    const set = new Set(this.terms().map((t) => t.term[0]?.toUpperCase()).filter(Boolean));
    return Array.from(set).sort();
  });

  readonly filteredTerms = computed(() => {
    const query = this.search().trim().toLowerCase();
    const letter = this.activeLetter();
    return this.terms().filter((t) => {
      const matchesSearch = !query || t.term.toLowerCase().includes(query) || t.definition.toLowerCase().includes(query);
      const matchesLetter = !letter || t.term[0]?.toUpperCase() === letter;
      return matchesSearch && matchesLetter;
    });
  });

  async ngOnInit(): Promise<void> {
    this.meta.set({
      title: 'YouTube Thumbnail Glossary — Terms & Definitions',
      description:
        'Clear definitions for every YouTube thumbnail, CTR, and creator-analytics term — from AI thumbnail scoring to watch time.',
      canonical: 'https://thumbnail-roast.com/glossary',
    });

    this.schema.clear();
    this.schema.breadcrumb([
      { name: 'Home', url: 'https://thumbnail-roast.com' },
      { name: 'Glossary', url: 'https://thumbnail-roast.com/glossary' },
    ]);

    try {
      this.terms.set(await this.glossaryService.getTerms());
    } finally {
      this.loading.set(false);
    }
  }

  setLetter(letter: string | null): void {
    this.activeLetter.set(this.activeLetter() === letter ? null : letter);
  }
}
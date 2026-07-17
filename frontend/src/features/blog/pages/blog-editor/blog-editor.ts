import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BlogService, BlogPostPayload } from '../../../../core/services/blog';
import { Toast } from '../../../../core/services/toast';
import { Supabase } from '../../../../core/services/supabase';
import { LucideAngularModule, Save, X, Image, Eye, Edit3 } from 'lucide-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-blog-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './blog-editor.html',
  styleUrl: './blog-editor.scss',
})
export class BlogEditor implements OnInit {
  private fb = inject(FormBuilder);
  private blogService = inject(BlogService);
  private router = inject(Router);
  private toast = inject(Toast);
  private supabase = inject(Supabase);

  readonly loading = signal(false);
  readonly previewMode = signal<'edit' | 'preview'>('edit');

  // ─── Form ────────────────────────────────────────────────────────────────
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    excerpt: ['', [Validators.required]],
    content: ['', [Validators.required]],
    cover_image_url: [''],
    category_id: [''],
    meta_title: [''],
    meta_description: [''],
    featured: [false],
    status: ['published'], // 👈 default to published so it's immediately visible
    author_id: [''],
    faq: [''],
  });

  readonly icons = {
    save: Save,
    x: X,
    image: Image,
    eye: Eye,
    edit: Edit3,
  };

  ngOnInit(): void {
 
  }

  // ─── Live preview ──────────────────────────────────────────────────────────
  get previewHtml(): string {
    const content = this.form.get('content')?.value || '';
    return this.processContent(content).html;
  }

  // ─── Auto-generate slug ────────────────────────────────────────────────────
  generateSlug(): void {
    const title = this.form.get('title')?.value;
    if (title) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      this.form.patchValue({ slug });
    }
  }

  // ─── Submit ────────────────────────────────────────────────────────────────
  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fill in all required fields');
      return;
    }

    this.loading.set(true);
    try {
      const raw = this.form.value;
      const user = this.supabase.currentUser();

      const payload: BlogPostPayload = {
        title: raw.title!,
        slug: raw.slug!,
        excerpt: raw.excerpt!,
        content: raw.content!,
        cover_image_url: raw.cover_image_url || null,
        category_id: raw.category_id || null,
        meta_title: raw.meta_title || null,
        meta_description: raw.meta_description || null,
        featured: raw.featured || false,
        status: raw.status as 'draft' | 'published',
        author_id: 'cf712663-ec8d-455c-9752-3c44dc384624',
        faq: raw.faq ? JSON.parse(raw.faq) : null,
        read_time_minutes: this.blogService.readTime(raw.content!),
      };

      console.log('Creating post with payload:', payload);

      const post = await this.blogService.createPost(payload);
      console.log('Post created:', post);

      this.toast.success('Post created successfully!');
      this.router.navigate(['/blog', post.slug]);
    } catch (err) {
      console.error('Create post error:', err);
      this.toast.error('Failed to create post. Check console for details.');
    } finally {
      this.loading.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/blog']);
  }

  // ─── Image upload ──────────────────────────────────────────────────────────
  async uploadImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      this.toast.error('Please select an image file');
      return;
    }

    const fileName = `blog/${Date.now()}-${file.name}`;
    try {
      const { data, error } = await this.supabase.client.storage
        .from('blog-images')
        .upload(fileName, file, { contentType: file.type });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = this.supabase.client.storage.from('blog-images').getPublicUrl(fileName);

      // Insert markdown image at cursor position
      const content = this.form.get('content')!;
      const textarea = document.querySelector('#content') as HTMLTextAreaElement;
      const start = textarea?.selectionStart ?? content.value.length;
      const end = textarea?.selectionEnd ?? start;
      const before = content.value.substring(0, start);
      const after = content.value.substring(end);
      const imageMarkdown = `\n![image](${publicUrl})\n`;
      content.setValue(before + imageMarkdown + after);

      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          const newPos = start + imageMarkdown.length;
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 0);

      this.toast.success('Image uploaded & inserted');
    } catch (err) {
      console.error('Image upload error:', err);
      this.toast.error('Failed to upload image');
    }
  }

  // ─── Toggle preview ────────────────────────────────────────────────────────
  togglePreview(): void {
    this.previewMode.update((mode) => (mode === 'edit' ? 'preview' : 'edit'));
  }

  // ─── Markdown processing (mirrors BlogPost) ──────────────────────────────
  private processContent(content: string): { html: string; toc: any[] } {
    if (!content) return { html: '', toc: [] };
    let html = content;

    // Tables
    html = html.replace(/((?:^\|.*\|$\n?)+)/gm, (tableBlock: string) => {
      const lines = tableBlock
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      if (lines.length < 2) return tableBlock;
      const hasSeparator = lines.some((line) => /^[\s\|:-]+$/.test(line.replace(/\|/g, '').trim()));
      if (!hasSeparator) return tableBlock;
      let headerRow = '',
        bodyRows = '',
        isHeader = true;
      for (const line of lines) {
        if (/^[\s\|:-]+$/.test(line.replace(/\|/g, '').trim())) {
          isHeader = false;
          continue;
        }
        const cells = line
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c !== '');
        if (cells.length === 0) continue;
        const rowHtml = cells.map((c) => `<td>${c}</td>`).join('');
        if (isHeader) {
          headerRow = `<thead><tr>${cells.map((c) => `<th>${c}</th>`).join('')}</tr></thead>`;
        } else {
          bodyRows += `<tr>${rowHtml}</tr>`;
        }
      }
      if (!headerRow && bodyRows) {
        const firstRow = bodyRows.split('</tr>')[0] + '</tr>';
        headerRow = `<thead>${firstRow.replace(/td>/g, 'th>')}</thead>`;
        bodyRows = bodyRows.replace(firstRow, '');
      }
      return `<table>${headerRow}<tbody>${bodyRows}</tbody></table>`;
    });

    // Images
    html = html.replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<figure class="article-image"><img src="$2" alt="$1" loading="lazy"><figcaption>$1</figcaption></figure>',
    );

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold, italic, code, links
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    // Lists
    html = html.replace(/(?:^|\n)[\-\*]\s+(.+)(?:\n[\-\*]\s+.+)*/g, (match) => {
      const items = match
        .split('\n')
        .filter((line) => line.trim().startsWith('-') || line.trim().startsWith('*'));
      const listHtml = items
        .map((item) => `<li>${item.replace(/^[\-\*]\s+/, '').trim()}</li>`)
        .join('');
      return `<ul>${listHtml}</ul>`;
    });
    html = html.replace(/(?:^|\n)\d+\.\s+(.+)(?:\n\d+\.\s+.+)*/g, (match) => {
      const items = match.split('\n').filter((line) => /^\d+\./.test(line.trim()));
      const listHtml = items
        .map((item) => `<li>${item.replace(/^\d+\.\s+/, '').trim()}</li>`)
        .join('');
      return `<ol>${listHtml}</ol>`;
    });

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

    // Paragraphs
    const blockTags = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'table',
      'blockquote',
      'figure',
    ];
    const blockTagRegex = new RegExp(`</?(${blockTags.join('|')})[^>]*>`, 'g');
    const parts = html.split(/\n\n/);
    html = parts
      .map((part) => {
        if (blockTagRegex.test(part)) return part;
        if (!part.trim()) return '';
        if (!/^<[a-z]/.test(part.trim())) return `<p>${part.trim()}</p>`;
        return part;
      })
      .join('');

    // Extract TOC from h2 tags
    const toc: any[] = [];
    html = html.replace(/<h2>(.*?)<\/h2>/g, (_, text) => {
      const id = text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      toc.push({ id, text });
      return `<h2 id="${id}">${text}</h2>`;
    });

    return { html, toc };
  }
}

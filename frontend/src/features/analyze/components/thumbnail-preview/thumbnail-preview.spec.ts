import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThumbnailPreview } from './thumbnail-preview';

describe('ThumbnailPreview', () => {
  let component: ThumbnailPreview;
  let fixture: ComponentFixture<ThumbnailPreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThumbnailPreview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThumbnailPreview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

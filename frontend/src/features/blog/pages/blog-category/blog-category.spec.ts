import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlogCategory } from './blog-category';

describe('BlogCategory', () => {
  let component: BlogCategory;
  let fixture: ComponentFixture<BlogCategory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlogCategory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlogCategory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

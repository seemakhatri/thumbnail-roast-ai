import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PostHero } from './post-hero';

describe('PostHero', () => {
  let component: PostHero;
  let fixture: ComponentFixture<PostHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostHero]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PostHero);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

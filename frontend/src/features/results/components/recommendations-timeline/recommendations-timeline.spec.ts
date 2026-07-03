import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecommendationsTimeline } from './recommendations-timeline';

describe('RecommendationsTimeline', () => {
  let component: RecommendationsTimeline;
  let fixture: ComponentFixture<RecommendationsTimeline>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecommendationsTimeline]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecommendationsTimeline);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

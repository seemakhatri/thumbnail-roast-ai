import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecommendationsCard } from './recommendations-card';

describe('RecommendationsCard', () => {
  let component: RecommendationsCard;
  let fixture: ComponentFixture<RecommendationsCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecommendationsCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecommendationsCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

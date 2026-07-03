import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportHeroCard } from './report-hero-card';

describe('ReportHeroCard', () => {
  let component: ReportHeroCard;
  let fixture: ComponentFixture<ReportHeroCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportHeroCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportHeroCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

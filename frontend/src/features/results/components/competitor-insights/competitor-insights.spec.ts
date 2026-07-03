import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompetitorInsights } from './competitor-insights';

describe('CompetitorInsights', () => {
  let component: CompetitorInsights;
  let fixture: ComponentFixture<CompetitorInsights>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompetitorInsights]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompetitorInsights);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

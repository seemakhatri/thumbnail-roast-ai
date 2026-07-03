import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScoreOverview } from './score-overview';

describe('ScoreOverview', () => {
  let component: ScoreOverview;
  let fixture: ComponentFixture<ScoreOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScoreOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScoreOverview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScoreRing } from './score-ring';

describe('ScoreRing', () => {
  let component: ScoreRing;
  let fixture: ComponentFixture<ScoreRing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScoreRing]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScoreRing);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

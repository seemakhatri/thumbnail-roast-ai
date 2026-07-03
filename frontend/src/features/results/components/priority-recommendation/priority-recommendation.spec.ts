import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PriorityRecommendation } from './priority-recommendation';

describe('PriorityRecommendation', () => {
  let component: PriorityRecommendation;
  let fixture: ComponentFixture<PriorityRecommendation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriorityRecommendation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PriorityRecommendation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

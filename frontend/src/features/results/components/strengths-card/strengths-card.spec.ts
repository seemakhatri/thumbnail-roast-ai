import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StrengthsCard } from './strengths-card';

describe('StrengthsCard', () => {
  let component: StrengthsCard;
  let fixture: ComponentFixture<StrengthsCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrengthsCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StrengthsCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

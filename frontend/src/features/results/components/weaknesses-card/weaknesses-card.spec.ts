import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeaknessesCard } from './weaknesses-card';

describe('WeaknessesCard', () => {
  let component: WeaknessesCard;
  let fixture: ComponentFixture<WeaknessesCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeaknessesCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeaknessesCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PricingSection } from './pricing-section';

describe('PricingSection', () => {
  let component: PricingSection;
  let fixture: ComponentFixture<PricingSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PricingSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PricingSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

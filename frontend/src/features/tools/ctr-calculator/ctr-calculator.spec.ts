import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CtrCalculator } from './ctr-calculator';

describe('CtrCalculator', () => {
  let component: CtrCalculator;
  let fixture: ComponentFixture<CtrCalculator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CtrCalculator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CtrCalculator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

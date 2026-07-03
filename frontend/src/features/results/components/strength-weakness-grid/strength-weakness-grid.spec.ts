import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StrengthWeaknessGrid } from './strength-weakness-grid';

describe('StrengthWeaknessGrid', () => {
  let component: StrengthWeaknessGrid;
  let fixture: ComponentFixture<StrengthWeaknessGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrengthWeaknessGrid]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StrengthWeaknessGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

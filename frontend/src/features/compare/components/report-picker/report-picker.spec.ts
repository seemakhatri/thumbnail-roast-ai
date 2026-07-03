import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportPicker } from './report-picker';

describe('ReportPicker', () => {
  let component: ReportPicker;
  let fixture: ComponentFixture<ReportPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportPicker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportPicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

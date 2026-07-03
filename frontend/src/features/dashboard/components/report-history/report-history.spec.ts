import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportHistory } from './report-history';

describe('ReportHistory', () => {
  let component: ReportHistory;
  let fixture: ComponentFixture<ReportHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportHistory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportHistory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

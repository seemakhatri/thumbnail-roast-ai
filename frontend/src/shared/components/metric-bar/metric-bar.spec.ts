import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetricBar } from './metric-bar';

describe('MetricBar', () => {
  let component: MetricBar;
  let fixture: ComponentFixture<MetricBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetricBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MetricBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

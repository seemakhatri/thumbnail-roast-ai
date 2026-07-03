import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetricsGrid } from './metrics-grid';

describe('MetricsGrid', () => {
  let component: MetricsGrid;
  let fixture: ComponentFixture<MetricsGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetricsGrid]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MetricsGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

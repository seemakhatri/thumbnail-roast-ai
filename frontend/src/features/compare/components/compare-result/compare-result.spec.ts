import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompareResult } from './compare-result';

describe('CompareResult', () => {
  let component: CompareResult;
  let fixture: ComponentFixture<CompareResult>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareResult]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompareResult);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

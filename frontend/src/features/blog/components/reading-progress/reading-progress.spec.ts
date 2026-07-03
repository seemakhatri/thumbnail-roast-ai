import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReadingProgress } from './reading-progress';

describe('ReadingProgress', () => {
  let component: ReadingProgress;
  let fixture: ComponentFixture<ReadingProgress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReadingProgress]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReadingProgress);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

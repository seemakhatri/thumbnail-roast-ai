import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultsPage } from './results-page';

describe('ResultsPage', () => {
  let component: ResultsPage;
  let fixture: ComponentFixture<ResultsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TermPage } from './term-page';

describe('TermPage', () => {
  let component: TermPage;
  let fixture: ComponentFixture<TermPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TermPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

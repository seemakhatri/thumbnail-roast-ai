import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LegalSection } from './legal-section';

describe('LegalSection', () => {
  let component: LegalSection;
  let fixture: ComponentFixture<LegalSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LegalSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LegalSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

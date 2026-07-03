import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlossaryIndex } from './glossary-index';

describe('GlossaryIndex', () => {
  let component: GlossaryIndex;
  let fixture: ComponentFixture<GlossaryIndex>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlossaryIndex]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlossaryIndex);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

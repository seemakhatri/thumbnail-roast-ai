import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NichePage } from './niche-page';

describe('NichePage', () => {
  let component: NichePage;
  let fixture: ComponentFixture<NichePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NichePage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NichePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

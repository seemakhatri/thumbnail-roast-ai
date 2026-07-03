import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Waitlist } from './waitlist';

describe('Waitlist', () => {
  let component: Waitlist;
  let fixture: ComponentFixture<Waitlist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Waitlist]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Waitlist);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

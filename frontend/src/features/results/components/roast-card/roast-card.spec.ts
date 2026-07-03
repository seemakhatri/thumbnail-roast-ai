import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoastCard } from './roast-card';

describe('RoastCard', () => {
  let component: RoastCard;
  let fixture: ComponentFixture<RoastCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoastCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoastCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

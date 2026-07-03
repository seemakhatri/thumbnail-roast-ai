import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsageOverview } from './usage-overview';

describe('UsageOverview', () => {
  let component: UsageOverview;
  let fixture: ComponentFixture<UsageOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsageOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsageOverview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

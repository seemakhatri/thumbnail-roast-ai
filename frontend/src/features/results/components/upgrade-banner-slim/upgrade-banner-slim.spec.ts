import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpgradeBannerSlim } from './upgrade-banner-slim';

describe('UpgradeBannerSlim', () => {
  let component: UpgradeBannerSlim;
  let fixture: ComponentFixture<UpgradeBannerSlim>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpgradeBannerSlim]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpgradeBannerSlim);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

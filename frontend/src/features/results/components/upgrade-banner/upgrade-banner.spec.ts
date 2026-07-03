import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpgradeBanner } from './upgrade-banner';

describe('UpgradeBanner', () => {
  let component: UpgradeBanner;
  let fixture: ComponentFixture<UpgradeBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpgradeBanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpgradeBanner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

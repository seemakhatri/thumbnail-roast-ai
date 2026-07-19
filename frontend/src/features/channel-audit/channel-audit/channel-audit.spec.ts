import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelAudit } from './channel-audit';

describe('ChannelAudit', () => {
  let component: ChannelAudit;
  let fixture: ComponentFixture<ChannelAudit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelAudit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChannelAudit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

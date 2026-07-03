import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NicheHub } from './niche-hub';

describe('NicheHub', () => {
  let component: NicheHub;
  let fixture: ComponentFixture<NicheHub>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NicheHub]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NicheHub);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

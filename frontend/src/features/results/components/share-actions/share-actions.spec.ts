import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShareActions } from './share-actions';

describe('ShareActions', () => {
  let component: ShareActions;
  let fixture: ComponentFixture<ShareActions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShareActions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShareActions);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

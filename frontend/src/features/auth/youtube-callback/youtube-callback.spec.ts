import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YoutubeCallback } from './youtube-callback';

describe('YoutubeCallback', () => {
  let component: YoutubeCallback;
  let fixture: ComponentFixture<YoutubeCallback>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YoutubeCallback]
    })
    .compileComponents();

    fixture = TestBed.createComponent(YoutubeCallback);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ProfileViewWebComponent } from './profile-view-web.component';

describe('ProfileViewWebComponent', () => {
  let component: ProfileViewWebComponent;
  let fixture: ComponentFixture<ProfileViewWebComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ProfileViewWebComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileViewWebComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ProfileViewMovilComponent } from './profile-view-movil.component';

describe('ProfileViewMovilComponent', () => {
  let component: ProfileViewMovilComponent;
  let fixture: ComponentFixture<ProfileViewMovilComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ProfileViewMovilComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileViewMovilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

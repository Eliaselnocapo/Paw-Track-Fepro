import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { HomeViewWebComponent } from './home-view-web.component';

describe('HomeViewWebComponent', () => {
  let component: HomeViewWebComponent;
  let fixture: ComponentFixture<HomeViewWebComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HomeViewWebComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeViewWebComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { HomeViewMovilComponent } from './home-view-movil.component';

describe('HomeViewMovilComponent', () => {
  let component: HomeViewMovilComponent;
  let fixture: ComponentFixture<HomeViewMovilComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HomeViewMovilComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeViewMovilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

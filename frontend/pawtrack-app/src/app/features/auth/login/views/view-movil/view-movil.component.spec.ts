import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ViewMovilComponent } from './view-movil.component';

describe('ViewMovilComponent', () => {
  let component: ViewMovilComponent;
  let fixture: ComponentFixture<ViewMovilComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ViewMovilComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewMovilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

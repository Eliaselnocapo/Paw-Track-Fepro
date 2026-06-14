import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ViewWebComponent } from './view-web.component';

describe('ViewWebComponent', () => {
  let component: ViewWebComponent;
  let fixture: ComponentFixture<ViewWebComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ViewWebComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewWebComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

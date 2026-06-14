import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FooterWebComponent } from './footer-web.component';

describe('FooterWebComponent', () => {
  let component: FooterWebComponent;
  let fixture: ComponentFixture<FooterWebComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [FooterWebComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterWebComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

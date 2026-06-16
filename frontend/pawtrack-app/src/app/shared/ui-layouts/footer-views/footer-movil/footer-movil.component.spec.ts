import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FooterMovilComponent } from './footer-movil.component';

describe('FooterMovilComponent', () => {
  let component: FooterMovilComponent;
  let fixture: ComponentFixture<FooterMovilComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [FooterMovilComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterMovilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

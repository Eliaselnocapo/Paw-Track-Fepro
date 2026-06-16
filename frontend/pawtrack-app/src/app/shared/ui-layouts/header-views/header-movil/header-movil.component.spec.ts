import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { HeaderMovilComponent } from './header-movil.component';

describe('HeaderMovilComponent', () => {
  let component: HeaderMovilComponent;
  let fixture: ComponentFixture<HeaderMovilComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [HeaderMovilComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderMovilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

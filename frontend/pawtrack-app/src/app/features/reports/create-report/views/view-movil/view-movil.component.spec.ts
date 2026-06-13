import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RevisionMovilComponent } from './view-movil.component';

describe('RevisionMovilComponent', () => {
  let component: RevisionMovilComponent;
  let fixture: ComponentFixture<RevisionMovilComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [RevisionMovilComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RevisionMovilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

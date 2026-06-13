import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { RevisionWebComponent } from './view-web.component';

describe('RevisionWebComponent', () => {
  let component: RevisionWebComponent;
  let fixture: ComponentFixture<RevisionWebComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [RevisionWebComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RevisionWebComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

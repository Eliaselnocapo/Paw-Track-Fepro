import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AcceptCasePage } from './accept-case.page';

describe('AcceptCasePage', () => {
  let component: AcceptCasePage;
  let fixture: ComponentFixture<AcceptCasePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AcceptCasePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

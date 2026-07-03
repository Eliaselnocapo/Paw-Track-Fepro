import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AcceptedCasesPage } from './accepted-cases.page';

describe('AcceptedCasesPage', () => {
  let component: AcceptedCasesPage;
  let fixture: ComponentFixture<AcceptedCasesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AcceptedCasesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

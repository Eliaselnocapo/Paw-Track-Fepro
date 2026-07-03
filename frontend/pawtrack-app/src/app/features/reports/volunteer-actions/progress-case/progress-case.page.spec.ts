import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressCasePage } from './progress-case.page';

describe('ProgressCasePage', () => {
  let component: ProgressCasePage;
  let fixture: ComponentFixture<ProgressCasePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgressCasePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

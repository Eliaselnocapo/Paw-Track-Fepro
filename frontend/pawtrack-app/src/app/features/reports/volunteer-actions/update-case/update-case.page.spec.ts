import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpdateCasePage } from './update-case.page';

describe('UpdateCasePage', () => {
  let component: UpdateCasePage;
  let fixture: ComponentFixture<UpdateCasePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UpdateCasePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

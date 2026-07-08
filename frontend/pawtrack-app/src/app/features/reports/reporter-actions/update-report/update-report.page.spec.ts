import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpdateReportPage } from './update-report.page';

describe('UpdateReportPage', () => {
  let component: UpdateReportPage;
  let fixture: ComponentFixture<UpdateReportPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UpdateReportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

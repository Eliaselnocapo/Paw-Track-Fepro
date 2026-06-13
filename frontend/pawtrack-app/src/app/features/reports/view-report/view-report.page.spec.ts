import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewReportPage } from './view-report.page';

describe('ViewReportPage', () => {
  let component: ViewReportPage;
  let fixture: ComponentFixture<ViewReportPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewReportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

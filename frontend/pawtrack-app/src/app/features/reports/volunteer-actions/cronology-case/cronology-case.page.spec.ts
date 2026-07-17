import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CronologyCasePage } from './cronology-case.page';

describe('CronologyCasePage', () => {
  let component: CronologyCasePage;
  let fixture: ComponentFixture<CronologyCasePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CronologyCasePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailsCasePage } from './details-case.page';

describe('DetailsCasePage', () => {
  let component: DetailsCasePage;
  let fixture: ComponentFixture<DetailsCasePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DetailsCasePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

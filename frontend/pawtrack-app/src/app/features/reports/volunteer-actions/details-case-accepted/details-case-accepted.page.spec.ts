import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailsCaseAcceptedPage } from './details-case-accepted.page';

describe('DetailsCaseAcceptedPage', () => {
  let component: DetailsCaseAcceptedPage;
  let fixture: ComponentFixture<DetailsCaseAcceptedPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DetailsCaseAcceptedPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

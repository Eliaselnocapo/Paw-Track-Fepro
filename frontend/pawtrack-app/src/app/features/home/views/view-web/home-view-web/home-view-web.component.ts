import { Component, OnInit } from '@angular/core';
import { NavbarWebComponent } from '../../../../../shared/ui-layouts/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../../shared/ui-layouts/footer-web/footer-web.component';

@Component({
  selector: 'app-home-view-web',
  templateUrl: './home-view-web.component.html',
  styleUrls: ['./home-view-web.component.scss'],
  imports: [NavbarWebComponent, FooterWebComponent],
  standalone: true,
})
export class HomeViewWebComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}

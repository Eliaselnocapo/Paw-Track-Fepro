import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar-web',
  templateUrl: './navbar-web.component.html',
  styleUrls: ['./navbar-web.component.scss'],
  standalone: true,
  imports: [RouterLink, RouterLinkActive]
})
export class NavbarWebComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}

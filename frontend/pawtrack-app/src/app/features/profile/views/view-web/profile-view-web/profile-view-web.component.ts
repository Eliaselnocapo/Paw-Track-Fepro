import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarWebComponent } from '../../../../../shared/ui-layouts/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../../shared/ui-layouts/footer-web/footer-web.component';

@Component({
  selector: 'app-profile-view-web',
  standalone: true,
  imports: [CommonModule, NavbarWebComponent, FooterWebComponent],
  templateUrl: './profile-view-web.component.html',
  styleUrls: ['./profile-view-web.component.scss']
})
export class ProfileViewWebComponent {
  @Input() usuario!: any;
}

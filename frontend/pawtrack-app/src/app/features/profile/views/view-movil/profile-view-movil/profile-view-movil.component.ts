import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from 'src/app/shared/ui-layouts/navbar-views/navbar/navbar.component';

@Component({
  selector: 'app-profile-view-movil',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './profile-view-movil.component.html',
  styleUrls: ['./profile-view-movil.component.scss']
})
export class ProfileViewMovilComponent {
  @Input() usuario!: any;
}

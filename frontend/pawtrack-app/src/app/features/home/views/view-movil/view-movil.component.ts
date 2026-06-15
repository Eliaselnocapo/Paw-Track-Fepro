import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { HeaderMovilComponent } from '../../../../shared/ui-layouts/header-views/header-movil/header-movil.component';
import { FooterMovilComponent } from '../../../../shared/ui-layouts/footer-views/footer-movil/footer-movil.component';
import { NavbarComponent } from '../../../../shared/ui-layouts/navbar-views/navbar/navbar.component';

@Component({
  selector: 'app-view-movil',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    HeaderMovilComponent,
    FooterMovilComponent,
    NavbarComponent
  ],
  templateUrl: './view-movil.component.html',
  styleUrls: ['./view-movil.component.scss']
})
export class ViewMovilComponent {}

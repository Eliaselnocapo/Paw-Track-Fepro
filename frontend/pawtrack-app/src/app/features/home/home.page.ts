import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { NavbarWebComponent } from '../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { RevealDirective } from 'src/app/shared/directives/reveal.directive';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
    RevealDirective
  ]
})
export class HomePage implements OnInit {
  private authService = inject(AuthService);

  constructor() { }

  ngOnInit() {
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }
}
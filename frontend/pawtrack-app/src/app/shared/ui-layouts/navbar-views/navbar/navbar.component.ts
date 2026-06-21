import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterLink],
})
export class NavbarComponent implements OnInit, OnDestroy {

  private router = inject(Router);
  private authService = inject(AuthService);

  rutaActiva = '';
  private routerSubscription?: Subscription;

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    this.rutaActiva = this.router.url;

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        const navigationEnd = event as NavigationEnd;
        this.rutaActiva = navigationEnd.urlAfterRedirects;
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  estaActiva(ruta: string): boolean {
    return this.rutaActiva === ruta || this.rutaActiva.startsWith(ruta + '/');
  }
}
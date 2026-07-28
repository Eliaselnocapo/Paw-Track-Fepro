import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import {
  IonContent,
  IonMenu,
  IonMenuToggle
} from '@ionic/angular/standalone';

import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive
} from '@angular/router';

import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [
    IonApp,
    IonRouterOutlet,
    IonMenu,
    IonContent,
    IonMenuToggle,
    RouterLink,
    RouterLinkActive
  ],
})
export class AppComponent {

  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd =>
          event instanceof NavigationEnd
        )
      )
      .subscribe(() => {
        requestAnimationFrame(() => {
          // Reinicia el scroll normal del navegador.
          window.scrollTo(0, 0);

          // Reinicia el scroll interno de Ionic.
          const contenidoActivo = document.querySelector(
            'ion-router-outlet .ion-page:not(.ion-page-hidden) ion-content'
          ) as HTMLIonContentElement | null;

          contenidoActivo?.scrollToTop(0);
        });
      });
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

}

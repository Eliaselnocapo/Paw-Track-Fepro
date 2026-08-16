import { Component, inject, OnDestroy } from '@angular/core';
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
import { NotificacionesService } from './core/services/notificaciones.service';
import { ToastContainerComponent } from './shared/toast/toast-container.component';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    IonApp,
    IonRouterOutlet,
    IonMenu,
    IonContent,
    IonMenuToggle,
    RouterLink,
    RouterLinkActive,
    ToastContainerComponent
  ],
})
export class AppComponent implements OnDestroy {

  readonly notifService = inject(NotificacionesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private inicioX = 0;
  private inicioY = 0;
  private puedeRefrescar = false;
  refrescando = false;

  private readonly touchStartHandler = (
    event: TouchEvent
  ): void => {
    void this.iniciarDeslizamiento(event);
  };

  private readonly touchEndHandler = (
    event: TouchEvent
  ): void => {
    this.terminarDeslizamiento(event);
  };
  ngOnInit(): void {
    this.notifService.refrescarContador();
  }

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

      document.addEventListener(
        'touchstart',
        this.touchStartHandler,
        { passive: true }
      );

      document.addEventListener(
        'touchend',
        this.touchEndHandler,
        { passive: true }
      );
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  private async iniciarDeslizamiento(
  event: TouchEvent
): Promise<void> {
  const toque = event.touches[0];

  if (!toque) {
    this.reiniciarGesto();
    return;
  }

  const elementoTocado = event.target as HTMLElement | null;

  // Evita refrescar cuando se desliza dentro del menú lateral.
  if (elementoTocado?.closest('ion-menu')) {
    this.reiniciarGesto();
    return;
  }

  this.inicioX = toque.clientX;
  this.inicioY = toque.clientY;

  const contenidoActivo = this.obtenerContenidoActivo();

  if (!contenidoActivo) {
    this.puedeRefrescar = window.scrollY <= 0;
    return;
  }

  try {
    const scrollInterno =
      await contenidoActivo.getScrollElement();

    this.puedeRefrescar =
      scrollInterno.scrollTop <= 1;
  } catch {
    this.puedeRefrescar = false;
  }
}

private terminarDeslizamiento(
  event: TouchEvent
): void {
  if (!this.puedeRefrescar || this.refrescando) {
    this.reiniciarGesto();
    return;
  }

  const toque = event.changedTouches[0];

  if (!toque) {
    this.reiniciarGesto();
    return;
  }

  const movimientoX =
    Math.abs(toque.clientX - this.inicioX);

  const movimientoY =
    toque.clientY - this.inicioY;

  const esMovimientoVertical =
    movimientoY > movimientoX;

  const superaDistanciaMinima =
    movimientoY >= 100;

 if (
  esMovimientoVertical &&
  superaDistanciaMinima
) {
  this.refrescando = true;

  setTimeout(() => {
    window.location.reload();
  }, 1350);

  return;
}

  this.reiniciarGesto();
}

private obtenerContenidoActivo():
  HTMLIonContentElement | null {
  return document.querySelector(
    'ion-router-outlet ' +
    '.ion-page:not(.ion-page-hidden) ' +
    'ion-content'
  ) as HTMLIonContentElement | null;
}

private reiniciarGesto(): void {
  this.inicioX = 0;
  this.inicioY = 0;
  this.puedeRefrescar = false;
}

  ngOnDestroy(): void {
  document.removeEventListener(
    'touchstart',
    this.touchStartHandler
  );

  document.removeEventListener(
    'touchend',
    this.touchEndHandler
  );
}

}

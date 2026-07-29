import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-pull-to-refresh',
  standalone: true,
  imports: [
    IonRefresher,
    IonRefresherContent,
  ],
  templateUrl: './pull-to-refresh.component.html',
})
export class PullToRefreshComponent {

  constructor(private router: Router) {}

  async refrescar(event: RefresherCustomEvent): Promise<void> {
    const rutaActual = this.router.url;

    try {
      await this.router.navigateByUrl('/temporal', {
        skipLocationChange: true,
      });

      await this.router.navigateByUrl(rutaActual);
    } finally {
      event.target.complete();
    }
  }
}

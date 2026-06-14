import { Component, HostListener } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

import { HomeViewWebComponent } from './views/view-web/home-view-web/home-view-web.component';
import { HomeViewMovilComponent } from './views/view-movil/home-view-movil/home-view-movil.component';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    IonContent,
    HomeViewWebComponent,
    HomeViewMovilComponent
  ],
})
export class HomePage {
  esPantallaGrande = window.innerWidth >= 768;

  @HostListener('window:resize')
  onResize() {
    this.esPantallaGrande = window.innerWidth >= 768;
  }
}

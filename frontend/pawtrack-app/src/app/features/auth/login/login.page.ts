import { Component } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { IonContent } from '@ionic/angular/standalone';

// Importamos a los dos albañiles del login
import { ViewWebComponent } from './views/view-web/view-web.component';
import { ViewMovilComponent } from './views/view-movil/view-movil.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: true,
  imports: [IonContent, ViewWebComponent, ViewMovilComponent]
})
export class LoginPage {
  
  esPantallaGrande: boolean = false;

  constructor(private breakpointObserver: BreakpointObserver) {
    // Escucha el tamaño de la pantalla
    this.breakpointObserver.observe('(min-width: 768px)').subscribe(result => {
      this.esPantallaGrande = result.matches;
    });
  }
}
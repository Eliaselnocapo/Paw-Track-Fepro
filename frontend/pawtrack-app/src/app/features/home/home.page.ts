import { Component } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { IonContent } from '@ionic/angular/standalone';
import { ViewWebComponent } from './views/view-web/view-web.component';
import { ViewMovilComponent } from './views/view-movil/view-movil.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, ViewWebComponent, ViewMovilComponent]
})
export class HomePage {
  esPantallaGrande: boolean = false;

  constructor(private breakpointObserver: BreakpointObserver) {
    this.breakpointObserver.observe('(min-width: 768px)').subscribe(result => {
      this.esPantallaGrande = result.matches;
    });
  }
}

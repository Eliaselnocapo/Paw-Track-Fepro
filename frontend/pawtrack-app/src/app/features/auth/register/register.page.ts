import { Component } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ViewWebComponent } from './views/view-web/view-web.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ViewWebComponent],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss']
})
export class RegisterPage {
  esPantallaGrande: boolean = false;

  constructor(private breakpointObserver: BreakpointObserver) {
    // Escucha el tamaño de la pantalla
    this.breakpointObserver.observe('(min-width: 768px)').subscribe(result => {
      this.esPantallaGrande = result.matches;
    });
  }
}
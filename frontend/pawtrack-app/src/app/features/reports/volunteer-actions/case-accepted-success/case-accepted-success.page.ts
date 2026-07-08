import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

@Component({
  selector: 'app-case-accepted-success',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
  ],
  templateUrl: './case-accepted-success.page.html',
  styleUrls: ['./case-accepted-success.page.scss'],
})
export class CaseAcceptedSuccessPage implements OnInit {

  // Datos del caso que se acaba de aceptar,
  // llegados como queryParams desde accept-case.
  folio  = '';
  titulo = '';

  // Countdown de redirección automática (segundos)
  segundosRestantes = 10;
  private intervalo: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Leer folio y título de la URL
    this.folio  = this.route.snapshot.queryParamMap.get('folio')  ?? '';
    this.titulo = this.route.snapshot.queryParamMap.get('titulo') ?? 'el caso';

    // Redirigir automáticamente a mis casos aceptados después de 10 s
    this.intervalo = setInterval(() => {
      this.segundosRestantes--;
      if (this.segundosRestantes <= 0) this.irACasosAceptados();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  irACasosAceptados(): void {
    if (this.intervalo) clearInterval(this.intervalo);
    this.router.navigate(['/accepted-cases']);
  }

  verDetalleCaso(): void {
    if (this.intervalo) clearInterval(this.intervalo);
    this.router.navigate(['/details-case-accepted', this.folio]);
  }

  volverVolunteer(): void {
    if (this.intervalo) clearInterval(this.intervalo);
    this.router.navigate(['/volunteer']);
  }
}
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

import { ReportService, RescateResponse } from '../../../../core/services/report.service';

@Component({
  selector: 'app-rescue-complete',
  standalone: true,
  imports: [CommonModule, IonContent, NavbarWebComponent, FooterWebComponent],
  templateUrl: './rescue-complete.page.html',
  styleUrls: ['./rescue-complete.page.scss'],
})
export class RescueCompletePage implements OnInit {

  rescate: RescateResponse | null = null;
  cargando = true;
  folio = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
  ) {}

  ngOnInit(): void {
    this.folio = this.route.snapshot.paramMap.get('folio') || '';
    if (!this.folio) { this.cargando = false; return; }

    // Buscamos el rescate para mostrar un resumen (si falla, no rompe la pantalla)
    this.reportService.listarMisRescates().subscribe({
      next: (resp) => {
        this.rescate = resp.results.find(r => r.incidencia?.folio === this.folio) ?? null;
        this.cargando = false;
      },
      error: () => { this.cargando = false; },
    });
  }

  get titulo(): string {
    const i = this.rescate?.incidencia;
    return i?.nombre_caso?.trim() || 'Rescate completado';
  }

  get especie(): string { return this.rescate?.incidencia?.tipo_animal || 'Animal'; }

  get totalPasos(): number {
    return this.rescate?.historial?.length ?? 0;
  }

  irAMisCasos(): void {
    this.router.navigate(['/accepted-cases']);
  }

  irADisponibles(): void {
    this.router.navigate(['/dashboard/volunteer']);
  }
}
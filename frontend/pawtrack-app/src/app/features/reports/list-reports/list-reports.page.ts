import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { ReportService, IncidenciaResponse } from '../../../core/services/report.service';

@Component({
  selector: 'app-list-reports',
  templateUrl: './list-reports.page.html',
  styleUrls: ['./list-reports.page.scss'],
  standalone: true,
  imports: [CommonModule, DatePipe, IonContent, RouterLink],
})
export class ListReportsPage implements OnInit {

  incidencias: IncidenciaResponse[] = [];
  cargando  = true;
  errorCarga: string | null = null;
  totalCount = 0;

  constructor(
    private reportService: ReportService,
    private router:        Router,
  ) {}

  ngOnInit(): void {
    this.cargarIncidencias();
  }

  cargarIncidencias(): void {
    this.cargando   = true;
    this.errorCarga = null;

    this.reportService.listarReportes().subscribe({
      next: (resp) => {
        this.incidencias = resp;
        this.totalCount  = resp.length;
        this.cargando    = false;
      },
      error: () => {
        this.errorCarga = 'No se pudieron cargar los reportes. Verifica la conexión con el servidor.';
        this.cargando   = false;
      },
    });
  }

  verDetalle(id: number): void {
    this.router.navigate(['/view-report', id]);
  }

  urgencyLabel(score: number): string {
    if (score >= 80) return 'Urgente';
    if (score >= 40) return 'Moderado';
    return 'Bajo';
  }

  urgencyClass(score: number): string {
    if (score >= 80) return 'bg-error-container text-on-error-container';
    if (score >= 40) return 'bg-tertiary-container text-on-tertiary-container';
    return 'bg-secondary-container text-on-secondary-container';
  }

  estadoClass(estado: string): string {
    switch (estado) {
      case 'EN_PROCESO':  return 'bg-primary-container text-on-primary-container';
      case 'EN_REVISION': return 'bg-tertiary-container text-on-tertiary-container';
      case 'CERRADO':     return 'bg-secondary-container text-on-secondary-container';
      default:            return 'bg-surface-variant text-on-surface-variant';
    }
  }

  animalIcon(tipo: string | null): string {
    switch (tipo?.toLowerCase()) {
      case 'gato': return 'pets';
      case 'otro': return 'cruelty_free';
      default:     return 'pets';
    }
  }

  primerCondicion(val: string | null): string {
    if (!val) return 'Condición no especificada';
    return val.split(',')[0] ?? 'Condición no especificada';
  }

  imagenUrl(imagen: string | null): string {
    if (!imagen) return '';
    if (imagen.startsWith('http')) return imagen;
    return `http://localhost:8000${imagen}`;
  }
}

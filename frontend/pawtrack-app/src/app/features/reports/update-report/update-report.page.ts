import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { ViewWebComponent } from './views/view-web/view-web.component';
import { ViewMovilComponent } from './views/view-movil/view-movil.component';

@Component({
  selector: 'app-update-report',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    ViewWebComponent,
    ViewMovilComponent
  ],
  templateUrl: './update-report.page.html',
  styleUrls: ['./update-report.page.scss']
})
export class UpdateReportPage implements OnInit {
  esPantallaGrande = window.innerWidth >= 768;

  reporteId!: string;

  reporte = {
    folio: '2024-05-17A',
    estadoAnimal: 'En ruta a clínica',
    urgencia: 75,
    condiciones: {
      herido: true,
      deshidratado: false,
      asustado: true
    },
    observaciones: '',
    edadEstimada: '',
    pesoEstimado: '',
    tipoUbicacion: 'Urbano - Edificio Abandonado',
    direccion: 'Callejón del Gato Negro #14, CDMX',
    evidencia: null
  };

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.reporteId = this.route.snapshot.paramMap.get('id') || '';

    // Luego aquí irá el backend:
    // this.cargarReporte(this.reporteId);
  }

  @HostListener('window:resize')
  onResize() {
    this.esPantallaGrande = window.innerWidth >= 768;
  }

  enviarActualizacion(datos: any) {
    console.log('Actualizar reporte:', this.reporteId, datos);

    // Luego aquí irá el backend:
    // this.reportService.actualizarReporte(this.reporteId, datos).subscribe(...)
  }
}

import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

// Componentes de Layouts
import { NavbarWebComponent } from '../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

@Component({
  selector: 'app-update-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent
  ],
  templateUrl: './update-report.page.html',
  styleUrls: ['./update-report.page.scss']
})
export class UpdateReportPage implements OnInit {
  esPantallaGrande = window.innerWidth >= 768;
  reporteId!: string;

  // ESTA ES LA LISTA DINÁMICA QUE ALIMENTARÁ EL SELECT
  estadosDisponibles = [
    'En ruta a clínica',
    'En observación',
    'Rescatado',
    'Estable',
    'Crítico'
  ];
  // Objeto base del reporte
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
    // this.cargarReporte(this.reporteId);
  }

  @HostListener('window:resize')
  onResize() {
    this.esPantallaGrande = window.innerWidth >= 768;
  }

  // --- LÓGICA DE CÁLCULO DE URGENCIA ---

  calcularUrgencia(): number {
    const { herido, deshidratado, asustado } = this.reporte.condiciones;
    let urgencia = 0;
    if (herido) urgencia += 50;
    if (deshidratado) urgencia += 35;
    if (asustado) urgencia += 15;
    return urgencia;
  }

  obtenerTextoUrgencia(): string {
    const urgencia = this.calcularUrgencia();
    if (urgencia === 100) return 'CRÍTICA';
    if (urgencia >= 75) return 'ALTA';
    if (urgencia >= 35) return 'MEDIA';
    return 'BAJA';
  }

  obtenerColorUrgencia(): string {
    const urgencia = this.calcularUrgencia();
    if (urgencia === 100) return 'text-red-950';
    if (urgencia >= 75) return 'text-error';
    if (urgencia >= 35) return 'text-amber-600';
    return 'text-green-600';
  }

  obtenerBarraUrgencia(): number {
    const urgencia = this.calcularUrgencia();
    return Math.min(100, Math.max(0, urgencia));
  }

  // --- LÓGICA DE ENVÍO ---

  enviar() {
    console.log('Actualizando reporte con ID:', this.reporteId);
    console.log('Datos a enviar:', this.reporte);

    // Aquí irá tu lógica del backend después:
    // this.reportService.actualizarReporte(this.reporteId, this.reporte).subscribe(...)
  }
}
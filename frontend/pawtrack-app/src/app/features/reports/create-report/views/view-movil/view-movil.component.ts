import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent } from '@ionic/angular/standalone'; // Esto cura el error del <ion-content>
import { NavbarComponent } from '../../../../../shared/ui-layouts/navbar/navbar.component';

@Component({
  selector: 'app-view-movil',
  standalone: true,
  imports: [CommonModule, NavbarComponent, IonContent],
  templateUrl: './view-movil.component.html',
})
export class ViewMovilComponent {
  // === PUERTAS DE ENTRADA (Datos del Cerebro) ===
  @Input() pasoActual!: number;
  @Input() tipoAnimal!: string;
  @Input() tamanoAproximado!: string;
  @Input() condicionesVisibles!: string[];
  @Input() archivosSeleccionados!: any[];
  @Input() direccionActual!: string;
  @Input() ciudadActual!: string;
  @Input() latActual!: number;
  @Input() lngActual!: number;
  @Input() cargandoDireccion!: boolean;
  @Input() condicionesTexto!: string;
  @Input() proximosPasos!: any[];

  // === PUERTAS DE SALIDA (Avisos al Cerebro) ===
  @Output() onFileSelectedEvent = new EventEmitter<any>();
  @Output() regresarPasoEvent = new EventEmitter<void>();
  @Output() abrirCamaraEvent = new EventEmitter<void>();
  @Output() abrirGaleriaEvent = new EventEmitter<void>();
  @Output() eliminarArchivoEvent = new EventEmitter<any>();
  @Output() seleccionarTipoEvent = new EventEmitter<string>();
  @Output() seleccionarTamanoEvent = new EventEmitter<string>();
  @Output() toggleCondicionEvent = new EventEmitter<string>();
  @Output() irAMapaEvent = new EventEmitter<void>();
  @Output() buscarDireccionEvent = new EventEmitter<string>();
  @Output() siguientePasoEvent = new EventEmitter<void>();

  // === FUNCIONES PUENTE PARA TU HTML ===
  onFileSelected(event: any) { this.onFileSelectedEvent.emit(event); }
  regresarPaso() { this.regresarPasoEvent.emit(); }
  abrirCamara() { this.abrirCamaraEvent.emit(); }
  abrirGaleria() { this.abrirGaleriaEvent.emit(); }
  eliminarArchivo(archivo: any) { this.eliminarArchivoEvent.emit(archivo); }
  seleccionarTipo(tipo: string) { this.seleccionarTipoEvent.emit(tipo); }
  seleccionarTamano(tam: string) { this.seleccionarTamanoEvent.emit(tam); }
  toggleCondicion(cond: string) { this.toggleCondicionEvent.emit(cond); }
  irAMapa() { this.irAMapaEvent.emit(); }
  buscarDireccion(query: string) { this.buscarDireccionEvent.emit(query); }
  siguientePaso() { this.siguientePasoEvent.emit(); }

  // Lógica UI simple que puede vivir en el hijo
  tieneCondicion(condicion: string): boolean {
    return this.condicionesVisibles.includes(condicion);
  }
}
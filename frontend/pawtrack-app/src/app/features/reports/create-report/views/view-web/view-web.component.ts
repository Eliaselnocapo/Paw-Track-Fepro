import { Component, Input, Output, EventEmitter, } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { NavbarWebComponent } from '../../../../../shared/ui-layouts/navbar-web/navbar-web.component';

@Component({
  selector: 'app-view-web',
  templateUrl: './view-web.component.html',
  styleUrls: ['./view-web.component.scss'],
  imports: [CommonModule, DecimalPipe, NavbarWebComponent],
  standalone: true,
})
export class ViewWebComponent{
  // === VARIABLES QUE VIENEN DEL CEREBRO ===
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
  @Input() notasAdicionales!: string;
  @Input() folioGenerado!: number | null;
  // === EVENTOS PARA COMENTARLE AL CEREBRO ===
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

  onFileSelected(event: any) {this.onFileSelectedEvent.emit(event);}
  regresarPaso(){this.regresarPasoEvent.emit();}
  eliminarArchivo(archivo: any){this.eliminarArchivoEvent.emit(archivo);}
  siguientePaso(){this.siguientePasoEvent.emit();}
  seleccionarTipo(tipo: string) { this.seleccionarTipoEvent.emit(tipo); }
  seleccionarTamano(tamano: string) { this.seleccionarTamanoEvent.emit(tamano); }
  toggleCondicion(condicion: string) { this.toggleCondicionEvent.emit(condicion); }
  buscarDireccion(direccion: string) { this.buscarDireccionEvent.emit(direccion); }
  // --------------------------------

  // Lógica de UI local
  tieneCondicion(condicion: string): boolean {
    return this.condicionesVisibles ? this.condicionesVisibles.includes(condicion) : false;
  }

}

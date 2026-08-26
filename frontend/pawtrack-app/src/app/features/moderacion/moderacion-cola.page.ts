import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent } from '@ionic/angular/standalone';
import { NavbarWebComponent } from '../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import {
  ModeracionService,
  DenunciaCola,
  CentroPendiente,
} from 'src/app/core/services/moderacion.service';

@Component({
  selector: 'app-moderacion-cola',
  standalone: true,
  imports: [CommonModule, IonContent, NavbarWebComponent, FooterWebComponent],
  templateUrl: './moderacion-cola.page.html',
  styleUrls: ['./moderacion-cola.page.scss'],
})
export class ModeracionColaPage implements OnInit {
  private moderacion = inject(ModeracionService);

  denuncias: DenunciaCola[] = [];
  centrosPendientes: CentroPendiente[] = [];
  cargando = true;
  error = '';

  procesandoDenuncia: Record<string, boolean> = {};
  procesandoCentro: Record<number, boolean> = {};

  ngOnInit(): void {
    this.cargarCola();
  }

  cargarCola(): void {
    this.cargando = true;
    this.error = '';

    this.moderacion.obtenerCola().subscribe({
      next: (data) => {
        this.denuncias = data.denuncias;
        this.centrosPendientes = data.centros_pendientes;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.error = err?.error?.detail ?? 'No se pudo cargar la cola de moderación.';
      },
    });
  }

  resolverDenuncia(folio: string, accion: 'descartar' | 'confirmar_fraude'): void {
    this.procesandoDenuncia[folio] = true;

    this.moderacion.resolverDenuncia(folio, accion).subscribe({
      next: () => {
        this.procesandoDenuncia[folio] = false;
        this.denuncias = this.denuncias.filter((d) => d.folio !== folio);
      },
      error: (err) => {
        this.procesandoDenuncia[folio] = false;
        this.error = err?.error?.detail ?? 'No se pudo resolver la denuncia.';
      },
    });
  }

  resolverCentro(centroId: number, accion: 'aprobar' | 'rechazar', motivoRechazo: string = ''): void {
    this.procesandoCentro[centroId] = true;

    this.moderacion.resolverCentro(centroId, accion, motivoRechazo).subscribe({
      next: () => {
        this.procesandoCentro[centroId] = false;
        this.centrosPendientes = this.centrosPendientes.filter((c) => c.id !== centroId);
      },
      error: (err) => {
        this.procesandoCentro[centroId] = false;
        this.error = err?.error?.detail ?? 'No se pudo resolver la solicitud del centro.';
      },
    });
  }
}
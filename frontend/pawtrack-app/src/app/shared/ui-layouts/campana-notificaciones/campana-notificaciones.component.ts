import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import {
  NotificacionesService,
  Notificacion,
} from '../../../core/services/notificaciones.service';

@Component({
  selector: 'app-campana-notificaciones',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="relative" data-campana>

      <button type="button"
        (click)="toggle()"
        class="relative w-10 h-10 grid place-items-center rounded-full text-white hover:bg-white/15 transition-colors"
        [attr.aria-label]="'Notificaciones' + (svc.noLeidas() ? ', ' + svc.noLeidas() + ' sin leer' : '')">
        <span class="material-symbols-outlined text-[22px]">notifications</span>

        @if (svc.noLeidas() > 0) {
          <span class="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center
                       rounded-full bg-red-600 text-white text-[10px] font-bold border-2 border-[#2E5BD8]">
            {{ svc.noLeidas() > 9 ? '9+' : svc.noLeidas() }}
          </span>
        }
      </button>

      @if (abierto) {
        <div class="absolute right-0 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden z-50">

          <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <h3 class="font-bold text-slate-900 text-sm">Notificaciones</h3>
            @if (svc.noLeidas() > 0) {
              <button type="button" (click)="marcarTodas()"
                class="text-xs font-bold text-blue-700 hover:underline">
                Marcar todas
              </button>
            }
          </div>

          @if (cargando) {
            <p class="px-4 py-6 text-sm text-slate-400 text-center">Cargando...</p>
          } @else if (notificaciones.length === 0) {
            <div class="px-4 py-8 text-center">
              <span class="material-symbols-outlined text-4xl text-slate-300">notifications_off</span>
              <p class="text-sm text-slate-500 mt-2">No tienes notificaciones</p>
            </div>
          } @else {
            <div class="max-h-96 overflow-y-auto divide-y divide-slate-100">
              @for (n of notificaciones; track n.id) {
                <button type="button" (click)="abrir(n)"
                  class="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-slate-50 transition-colors"
                  [ngClass]="n.leida ? '' : 'bg-blue-50/50'">

                  <span class="w-9 h-9 rounded-full grid place-items-center shrink-0"
                    [ngClass]="svc.colorIcono(n.tipo)">
                    <span class="material-symbols-outlined text-[18px]">{{ svc.icono(n.tipo) }}</span>
                  </span>

                  <span class="flex-1 min-w-0">
                    <span class="block text-sm font-bold text-slate-900 leading-snug">{{ n.titulo }}</span>
                    @if (n.mensaje) {
                      <span class="block text-xs text-slate-500 mt-0.5 line-clamp-2">{{ n.mensaje }}</span>
                    }
                    <span class="block text-[11px] text-slate-400 mt-1">{{ svc.tiempoRelativo(n.created_at) }}</span>
                  </span>

                  @if (!n.leida) {
                    <span class="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-2"></span>
                  }
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CampanaNotificacionesComponent implements OnInit {

  readonly svc = inject(NotificacionesService);
  private readonly router = inject(Router);

  abierto = false;
  cargando = false;
  notificaciones: Notificacion[] = [];

  ngOnInit(): void {
    this.svc.refrescarContador();
  }

  toggle(): void {
    this.abierto = !this.abierto;
    // Se cargan al abrir, no al iniciar: el contador ya dice si hay algo,
    // traer la lista completa en cada carga de página sería desperdicio.
    if (this.abierto) this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    this.svc.listar().subscribe({
      next: (resp) => {
        this.notificaciones = resp.results.slice(0, 10);
        this.cargando = false;
        // Ver el panel cuenta como haberlas leído.
        if (this.svc.noLeidas() > 0) {
          this.svc.marcarTodasLeidas().subscribe(() => {
            this.notificaciones.forEach((n) => (n.leida = true));
          });
        }
      },
      error: () => { this.notificaciones = []; this.cargando = false; },
    });
  }

  abrir(n: Notificacion): void {
    this.abierto = false;

    if (!n.leida) {
      this.svc.marcarLeida(n.id).subscribe();
      n.leida = true;
    }

    if (n.enlace) this.router.navigateByUrl(n.enlace);
  }

  marcarTodas(): void {
    this.svc.marcarTodasLeidas().subscribe(() => {
      this.notificaciones.forEach((n) => (n.leida = true));
    });
  }

  @HostListener('document:click', ['$event'])
  onClickFuera(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-campana]')) this.abierto = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.abierto = false;
  }
}
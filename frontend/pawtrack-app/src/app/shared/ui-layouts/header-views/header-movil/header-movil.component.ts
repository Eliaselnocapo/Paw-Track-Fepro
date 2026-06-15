import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header-movil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header-movil.component.html',
  styleUrls: ['./header-movil.component.scss']
})
export class HeaderMovilComponent {
  @Input() titulo = 'PawTrack';
  @Input() mostrarRegresar = true;
  @Input() mostrarNotificaciones = true;
  @Input() rutaRegreso?: string;

  @Output() notificacionesClick = new EventEmitter<void>();

  constructor(
    private location: Location,
    private router: Router
  ) {}

  regresar() {
    if (this.rutaRegreso) {
      this.router.navigateByUrl(this.rutaRegreso);
      return;
    }

    this.location.back();
  }

  abrirNotificaciones() {
    this.notificacionesClick.emit();
  }
}

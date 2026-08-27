import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModeracionService } from 'src/app/core/services/moderacion.service';

@Component({
  selector: 'app-reportar-fraude-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportar-fraude-button.component.html',
  styleUrls: ['./reportar-fraude-button.component.scss'],
})
export class ReportarFraudeButtonComponent {
  @Input({ required: true }) folio!: string;

  private moderacion = inject(ModeracionService);

  modalAbierto = false;
  motivo = '';
  enviando = false;
  error = '';
  exito = false;

  abrirModal(): void {
    this.modalAbierto = true;
    this.error = '';
    this.exito = false;
    this.motivo = '';
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  enviar(): void {
    // Si escribió algo, que no sea solo espacios en blanco — pero
    // dejarlo vacío del todo sigue siendo válido (el motivo es opcional).
    const motivoLimpio = this.motivo.trim();
    if (this.motivo.length > 0 && motivoLimpio.length === 0) {
      this.error = 'El motivo no puede ser solo espacios en blanco.';
      return;
    }
    if (motivoLimpio.length > 0 && motivoLimpio.length < 5) {
      this.error = 'Si vas a explicar el motivo, escribe al menos unas palabras.';
      return;
    }

    this.enviando = true;
    this.error = '';

    this.moderacion.reportarFraude(this.folio, motivoLimpio).subscribe({
      next: () => {
        this.enviando = false;
        this.exito = true;
        setTimeout(() => this.cerrarModal(), 1500);
      },
      error: (err) => {
        this.enviando = false;
        this.error = this.extraerMensajeError(err);
      },
    });
  }

  private extraerMensajeError(err: any): string {
    const code = err?.error?.code;

    // Mensajes específicos según el contrato de moderacion (SYSTEM_CONTRACT.md)
    if (code === 'cannot_report_own_case') {
      return 'No puedes reportar tu propio caso.';
    }
    if (code === 'fraude_ya_reportado') {
      return 'Ya habías reportado este caso antes.';
    }
    if (code === 'not_found') {
      return 'Este reporte ya no existe.';
    }

    return err?.error?.detail ?? 'No se pudo enviar el reporte. Intenta de nuevo.';
  }
}
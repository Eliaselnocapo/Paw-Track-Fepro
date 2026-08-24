import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { NavbarWebComponent } from '../../../../shared/ui-layouts/navbar-views/navbar-web/navbar-web.component';
import { FooterWebComponent } from '../../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { ReportService, IncidenciaResponse } from '../../../../core/services/report.service';
import { environment } from '../../../../../environments/environment';
import { RevealDirective } from '../../../../shared/directives/reveal.directive';

@Component({
  selector: 'app-case-accepted-success',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    NavbarWebComponent,
    FooterWebComponent,
    RevealDirective
  ],
  templateUrl: './case-accepted-success.page.html',
  styleUrls: ['./case-accepted-success.page.scss'],
})
export class CaseAcceptedSuccessPage implements OnInit, OnDestroy {

  folio  = '';
  titulo = '';
  caso: IncidenciaResponse | null = null;
  cargandoCaso = true;

  errorCaso = false;
  errorEsConexion = false;
  private subCaso: Subscription | null = null;
  private navegando = false;

  segundosRestantes = 10;
  private intervalo: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
  ) {}

  ngOnInit(): void {
    this.folio  = this.route.snapshot.queryParamMap.get('folio')  ?? '';
    this.titulo = this.route.snapshot.queryParamMap.get('titulo') ?? 'el caso';

    if (!this.folio) {
      this.cargandoCaso = false;
    } else {
      this.subCaso = this.reportService.obtenerReportePorFolio(this.folio).subscribe({
        next: (caso) => {
          this.caso = caso;
          this.cargandoCaso = false;
        },
        error: (err) => {
          console.error('No se pudo cargar el detalle del caso:', err);
          this.errorCaso = true;
          this.errorEsConexion = err.status === 0;
          this.cargandoCaso = false;
        }
      });
    }

    this.intervalo = setInterval(() => {
      this.segundosRestantes--;
      if (this.segundosRestantes <= 0) this.irACasosAceptados();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
    this.subCaso?.unsubscribe();
  }


  imagenFallback = false;

  onImagenError(): void {
    this.imagenFallback = true;
  }

  imagenUrl(imagen: string | null): string {
    if (this.imagenFallback || !imagen) return 'assets/images/report-placeholder.jpg';
    return imagen.startsWith('http') ? imagen : `${environment.apiUrl}${imagen}`;
  }
  
  irACasosAceptados(): void {
    if (this.navegando) return;
    this.navegando = true;
    if (this.intervalo) clearInterval(this.intervalo);
    this.router.navigate(['/accepted-cases']).catch(() => {
      window.location.href = '/accepted-cases';
    });
  }

  verDetalleCaso(): void {
    if (this.navegando) return;
    this.navegando = true;
    if (this.intervalo) clearInterval(this.intervalo);
    if (!this.folio) {
      this.irACasosAceptados();
      return;
    }
    this.router.navigate(['/details-case-accepted', this.folio]);
  }

  volverVolunteer(): void {
    if (this.navegando) return;
    this.navegando = true;
    if (this.intervalo) clearInterval(this.intervalo);
    this.router.navigate(['/volunteer']);
  }
}
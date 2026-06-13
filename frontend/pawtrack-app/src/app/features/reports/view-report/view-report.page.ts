import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { IonContent } from '@ionic/angular/standalone';

// Importamos a los dos albañiles
import { ViewMovilComponent } from './views/view-movil/view-movil.component';
import { ViewWebComponent } from './views/view-web/view-web.component';

@Component({
  selector: 'app-view-report',
  templateUrl: './view-report.page.html',
  styleUrls: ['./view-report.page.scss'],
  standalone: true,
  // ¡Asegúrate de que ambos estén aquí!
  imports: [IonContent, ViewMovilComponent, ViewWebComponent], 
})
export class ViewReportPage {

  esPantallaGrande: boolean = false;

  // Los datos viven en el Cerebro
  reporte = {
    folio: '4092',
    tipoAnimal: 'perro',
    tamano: 'mediano',
    condicionPrincipal: 'herido',
    descripcionCondicion: 'Pierna visible lastimada cubierta con un vendaje sucio',
    fotoUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800&auto=format&fit=crop',
    tiempoTranscurrido: '2h',
    direccion: 'Avenida Insurgentes Sur 123, Roma Norte',
    ciudad: 'Mexico City',
    lat: 19.4195,
    lng: -99.1617,
    timeline: [
      { id: 1, hora: 'Today, 14:30', titulo: 'Voluntario Asignado', descripcion: 'Maria esta en ruta para apoyar al animal', activo: true },
      { id: 2, hora: 'Today, 14:15', titulo: 'Caso Verificado', descripcion: 'Usuario confirmó detalles y situación', activo: false },
      { id: 3, hora: 'Today, 14:00', titulo: 'Reporte Inicial', descripcion: 'Reporte creado por usuario anonimo en la app', activo: false }
    ]
  };

  constructor(private router: Router, private breakpointObserver: BreakpointObserver) {
    // Escuchamos el tamaño de la pantalla
    this.breakpointObserver.observe('(min-width: 768px)').subscribe(result => {
      this.esPantallaGrande = result.matches;
    });
  }

  // La navegación la controla el Cerebro
  regresar(): void {
    this.router.navigate(['/home']);
  }
}
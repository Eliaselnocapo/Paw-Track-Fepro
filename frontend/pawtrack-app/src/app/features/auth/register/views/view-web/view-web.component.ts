import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-view-web',
  standalone: true,
  imports: [RouterLink], // <-- Obligatorio para los botones
  templateUrl: './view-web.component.html',
  styleUrls: ['./view-web.component.scss']
})
export class ViewWebComponent {
  // Lógica futura para el formulario
}
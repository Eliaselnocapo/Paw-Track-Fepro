import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer-movil',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer-movil.component.html',
  styleUrls: ['./footer-movil.component.scss']
})
export class FooterMovilComponent {}

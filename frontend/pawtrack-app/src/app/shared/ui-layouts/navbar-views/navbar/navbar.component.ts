import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterLink],
})
export class NavbarComponent implements OnInit {

  rutaActiva: string = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.rutaActiva = this.router.url;
  }
}

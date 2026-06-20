import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule, IonContent],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  email = '';
  password = '';
  cargando = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.error = 'Por favor completa todos los campos.';
      return;
    }

    this.cargando = true;
    this.error = '';

    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.cargando = false;
        const roles = res.user.roles ?? [];

        if (roles.length > 1) {
          this.router.navigate(['/role-selector']);
        } else {
          this.auth.setActiveRole(roles[0] ?? 'REPORTERO');
          this.router.navigate(['/home']);
        }
      },
      error: (err) => {
        this.cargando = false;
        this.error =
          err.error?.non_field_errors?.[0] ??
          err.error?.detail ??
          'Credenciales incorrectas. Inténtalo de nuevo.';
      },
    });
  }
}

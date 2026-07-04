import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { IonContent } from '@ionic/angular/standalone';
import { switchMap, map, catchError, of } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule, IonContent],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  selectedRole = 'REPORTERO';
  fullName = '';
  email = '';
  password = '';
  passwordConfirm = '';
  termsAccepted = false;
  cargando = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

onSubmit(): void {
  if (!this.fullName || !this.email || !this.password || !this.passwordConfirm) {
    this.error = 'Por favor completa todos los campos.';
    return;
  }
  if (this.password !== this.passwordConfirm) {
    this.error = 'Las contraseñas no coinciden.';
    return;
  }
  if (!this.termsAccepted) {
    this.error = 'Debes aceptar los Términos de Servicio para continuar.';
    return;
  }

  const partes = this.fullName.trim().split(' ');
  const first_name = partes[0] ?? '';
  const last_name = partes.slice(1).join(' ');

  this.cargando = true;
  this.error = '';

  this.auth
    .register({
      email: this.email,
      password1: this.password,
      password2: this.passwordConfirm,
      first_name,
      last_name,
      roles: ['REPORTERO'], // el registro nace como reportero...
    })
    .pipe(
      // ...y aquí le sumamos RESCATISTA + creamos su PerfilRescatista
      switchMap((res) =>
        this.auth.habilitarRoles(res.user.id).pipe(
          map(() => res),
          catchError(() => of(res)) // si falla el rol, igual dejamos entrar
        )
      )
    )
    .subscribe({
      next: (res) => {
        this.cargando = false;
        this.auth.setActiveRole('RESCATISTA');
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.cargando = false;
        const data = err.error ?? {};
        this.error =
          data.email?.[0] ??
          data.password1?.[0] ??
          data.non_field_errors?.[0] ??
          data.detail ??
          'Error al registrarse. Inténtalo de nuevo.';
      },
    });
}
}

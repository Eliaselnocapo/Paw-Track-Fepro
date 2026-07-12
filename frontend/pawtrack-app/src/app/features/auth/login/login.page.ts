import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { IonContent } from '@ionic/angular/standalone';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule, IonContent, FooterWebComponent],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  email = '';
  password = '';
  cargando = false;
  error = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

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

        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') || '/home';

        if (roles.length > 1) {
          this.router.navigate(['/home'], {
            queryParams: {
              returnUrl: returnUrl,
            },
          });
          return;
        }

        this.auth.setActiveRole(roles[0] ?? 'REPORTERO');

        this.router.navigateByUrl(returnUrl);
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
import { AfterViewInit, Component } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { IonContent } from '@ionic/angular/standalone';
import { FooterWebComponent } from '../../../shared/ui-layouts/footer-views/footer-web/footer-web.component';
import { environment } from 'src/environments/environment';

// Tipos mínimos del SDK de Google Identity Services (no viene con @types
// oficiales instalables limpios; declaramos solo lo que usamos).
declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule, IonContent, FooterWebComponent],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements AfterViewInit {
  email = '';
  password = '';
  cargando = false;
  error = '';

  cargandoGoogle = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngAfterViewInit(): void {
    this.inicializarBotonGoogle();
  }

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
        this.despuesDeAutenticar(res.user.roles ?? []);
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

  // ─────────────────────────────────────────
  // Login con Google
  // ─────────────────────────────────────────

  private inicializarBotonGoogle(): void {
    // El script de index.html carga async — puede que este método
    // corra antes de que "google" exista en window. Reintentamos unas
    // cuantas veces con un pequeño delay en vez de fallar en silencio.
    if (typeof google === 'undefined' || !google?.accounts?.id) {
      setTimeout(() => this.inicializarBotonGoogle(), 200);
      return;
    }

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (respuesta: { credential: string }) =>
        this.onCredencialGoogle(respuesta),
    });

    const contenedor = document.getElementById('google-signin-button');
    if (contenedor) {
      google.accounts.id.renderButton(contenedor, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        locale: 'es',
      });
    }
  }

  private onCredencialGoogle(respuesta: { credential: string }): void {
    if (!respuesta?.credential) return;

    this.cargandoGoogle = true;
    this.error = '';

    this.auth.loginConGoogle(respuesta.credential).subscribe({
      next: (res) => {
        this.cargandoGoogle = false;
        this.despuesDeAutenticar(res.user.roles ?? []);
      },
      error: (err) => {
        this.cargandoGoogle = false;
        this.error =
          err.error?.detail ??
          'No se pudo iniciar sesión con Google. Intenta de nuevo.';
      },
    });
  }

  // ─────────────────────────────────────────
  // Común a ambos flujos (email/password y Google)
  // ─────────────────────────────────────────

  private despuesDeAutenticar(roles: string[]): void {
    const returnUrl =
      this.route.snapshot.queryParamMap.get('returnUrl') || '/home';

    // El rol activo arranca en REPORTERO y se cambia desde el perfil. Antes
    // los usuarios con varios roles se desviaban al home a "elegir", pero esa
    // pantalla no existe — el efecto era perder el returnUrl.
    this.auth.setActiveRole(roles[0] ?? 'REPORTERO');
    this.router.navigateByUrl(returnUrl);
  }
}
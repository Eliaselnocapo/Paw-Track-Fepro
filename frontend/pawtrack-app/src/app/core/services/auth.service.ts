import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

export interface Usuario {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
  foto_perfil?: string | null;
  telefono?: string | null;
  ubicacion?: string | null;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: Usuario;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/auth`;

  private userSubject = new BehaviorSubject<Usuario | null>(this.leerUsuarioGuardado());
  private activeRoleSubject = new BehaviorSubject<string>('');

  user$ = this.userSubject.asObservable();
  activeRole$ = this.activeRoleSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API}/login/`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem('pawtrack_access', res.access);
          localStorage.setItem('pawtrack_refresh', res.refresh);
          this.setCurrentUser(res.user);
        })
      );
  }

  register(payload: {
    email: string;
    telefono: string; // NUEVO
    password1: string;
    password2: string;
    first_name: string;
    last_name: string;
    roles: string[];
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API}/registration/`, payload)
      .pipe(
        tap((res) => {
          localStorage.setItem('pawtrack_access', res.access);
          localStorage.setItem('pawtrack_refresh', res.refresh);
          this.setCurrentUser(res.user);
        })
      );
  }
 

  logout(): void {
    this.http.post(`${this.API}/logout/`, {}).subscribe({ error: () => {} });

    localStorage.removeItem('pawtrack_access');
    localStorage.removeItem('pawtrack_refresh');

    this.limpiarUsuario();
    this.activeRoleSubject.next('');

    // Recarga completa en vez de router.navigate: Ionic cachea las páginas,
    // así que con navigate los componentes ya montados conservan los datos
    // del usuario anterior hasta que se recarga a mano.
    window.location.href = '/home';
  }
  setActiveRole(role: string): void {
    this.activeRoleSubject.next(role);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('pawtrack_access');
  }

  getToken(): string | null {
    return localStorage.getItem('pawtrack_access');
  }

  getCurrentUser(): Usuario | null {
    return this.userSubject.getValue();
  }
/** Le da al usuario los roles REPORTERO + RESCATISTA y crea su PerfilRescatista en el back. */
  habilitarRoles(userId: number): Observable<Usuario> {
    return this.http
      .patch<Usuario>(
        `${environment.apiUrl}/usuarios/${userId}/roles/`,
        { roles: ['REPORTERO', 'RESCATISTA'] }
      )
      .pipe(
        tap((usuarioActualizado) => this.setCurrentUser(usuarioActualizado))
      );
  }
  /** El usuario vive en localStorage para sobrevivir a un refresh de la página. */
  private leerUsuarioGuardado(): Usuario | null {
    const raw = localStorage.getItem('pawtrack_user');
    if (!raw) return null;
    try { return JSON.parse(raw) as Usuario; } catch { return null; }
  }

  /** Guarda/actualiza el usuario en sesión (tras login o editar perfil). */
  setCurrentUser(usuario: Usuario): void {
    localStorage.setItem('pawtrack_user', JSON.stringify(usuario));
    this.userSubject.next(usuario);
  }

  private limpiarUsuario(): void {
    localStorage.removeItem('pawtrack_user');
    this.userSubject.next(null);
  }

  loginConGoogle(idToken: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API}/google/`, { id_token: idToken })
      .pipe(
        tap((res) => {
          localStorage.setItem('pawtrack_access', res.access);
          localStorage.setItem('pawtrack_refresh', res.refresh);
          this.setCurrentUser(res.user);
        })
      );
  }
}
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
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: Usuario;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/auth`;

  private userSubject = new BehaviorSubject<Usuario | null>(null);
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
          this.userSubject.next(res.user);
        })
      );
  }

  register(payload: {
    email: string;
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
          this.userSubject.next(res.user);
        })
      );
  }

  logout(): void {
    this.http.post(`${this.API}/logout/`, {}).subscribe({ error: () => {} });

    localStorage.removeItem('pawtrack_access');
    localStorage.removeItem('pawtrack_refresh');

    this.userSubject.next(null);
    this.activeRoleSubject.next('');

    this.router.navigate(['/home']);
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
        tap((usuarioActualizado) => this.userSubject.next(usuarioActualizado))
      );
  }
}
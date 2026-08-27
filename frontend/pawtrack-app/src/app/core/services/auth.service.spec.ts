import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

import { AuthService, AuthResponse, Usuario } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const API = `${environment.apiUrl}/auth`;

  const usuario: Usuario = {
    id: 1,
    email: 'user@example.com',
    first_name: 'Ana',
    last_name: 'Perez',
    roles: ['REPORTERO'],
    is_staff: false,
  };

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('login guarda access/refresh/user en localStorage y publica el usuario', (done) => {
    const respuesta: AuthResponse = { access: 'a1', refresh: 'r1', user: usuario };

    service.login('user@example.com', 'segura123').subscribe(() => {
      expect(localStorage.getItem('pawtrack_access')).toBe('a1');
      expect(localStorage.getItem('pawtrack_refresh')).toBe('r1');
      expect(JSON.parse(localStorage.getItem('pawtrack_user')!)).toEqual(usuario);
      expect(service.getCurrentUser()).toEqual(usuario);
      done();
    });

    const req = httpMock.expectOne(`${API}/login/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com', password: 'segura123' });
    req.flush(respuesta);
  });

  it('refrescarUsuario pide GET /auth/user/ y actualiza la sesión local (caso: is_staff cambió en el backend)', (done) => {
    localStorage.setItem('pawtrack_access', 'token-existente');
    // Simula el escenario del bug: el usuario cacheado en localStorage
    // quedó con is_staff desactualizado de un login anterior.
    localStorage.setItem('pawtrack_user', JSON.stringify({ ...usuario, is_staff: false }));

    const usuarioActualizado: Usuario = { ...usuario, is_staff: true };

    service.refrescarUsuario().subscribe((recibido) => {
      expect(recibido).toEqual(usuarioActualizado);
      expect(service.getCurrentUser()).toEqual(usuarioActualizado);
      expect(JSON.parse(localStorage.getItem('pawtrack_user')!).is_staff).toBeTrue();
      done();
    });

    const req = httpMock.expectOne(`${API}/user/`);
    expect(req.request.method).toBe('GET');
    req.flush(usuarioActualizado);
  });

  it('refrescarUsuario no revienta si el backend responde error (token vencido, offline): resuelve null', (done) => {
    localStorage.setItem('pawtrack_access', 'token-vencido');

    service.refrescarUsuario().subscribe((recibido) => {
      expect(recibido).toBeNull();
      done();
    });

    const req = httpMock.expectOne(`${API}/user/`);
    req.flush({ detail: 'Token inválido' }, { status: 401, statusText: 'Unauthorized' });
  });

  // NOTA: logout() termina con `window.location.href = '/home'` para forzar
  // una recarga completa (los comentarios en auth.service.ts explican por
  // qué). En Chrome real esa propiedad no es configurable, así que no se
  // puede espiar sin arriesgar que el test navegue de verdad el iframe de
  // Karma — se deja sin test unitario por esa limitación del entorno, no
  // porque el comportamiento no importe.

  it('isLoggedIn refleja la presencia del access token en localStorage', () => {
    localStorage.removeItem('pawtrack_access');
    expect(service.isLoggedIn()).toBeFalse();

    localStorage.setItem('pawtrack_access', 'a1');
    expect(service.isLoggedIn()).toBeTrue();
  });
});

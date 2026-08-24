import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { adminGuard } from './admin.guard';
import { AuthService, Usuario } from '../services/auth.service';

describe('adminGuard', () => {
  let router: jasmine.SpyObj<Router>;
  let userSubject: BehaviorSubject<Usuario | null>;
  let authServiceStub: Partial<AuthService>;

  const usuarioStaff: Usuario = {
    id: 1,
    email: 'admin@example.com',
    first_name: 'Admin',
    last_name: 'Uno',
    roles: [],
    is_staff: true,
  };

  const usuarioNormal: Usuario = { ...usuarioStaff, id: 2, is_staff: false };

  const ejecutarGuard = () =>
    TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/moderacion' } as any)
    );

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    userSubject = new BehaviorSubject<Usuario | null>(null);
    authServiceStub = { user$: userSubject.asObservable() };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: authServiceStub },
      ],
    });
  });

  afterEach(() => {
    localStorage.removeItem('pawtrack_access');
  });

  it('redirige a /login y no llega a leer el usuario si no hay token en localStorage', () => {
    localStorage.removeItem('pawtrack_access');

    const resultado = ejecutarGuard();

    expect(resultado).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/moderacion' },
    });
  });

  it('deja pasar cuando hay token y el usuario en memoria tiene is_staff true', (done) => {
    localStorage.setItem('pawtrack_access', 'token-falso');
    userSubject.next(usuarioStaff);

    const resultado = ejecutarGuard() as ReturnType<typeof of>;
    (resultado as any).subscribe((permitido: boolean) => {
      expect(permitido).toBeTrue();
      expect(router.navigate).not.toHaveBeenCalled();
      done();
    });
  });

  it('redirige a /home cuando hay token pero is_staff es false (dato desactualizado o usuario normal)', (done) => {
    localStorage.setItem('pawtrack_access', 'token-falso');
    userSubject.next(usuarioNormal);

    const resultado = ejecutarGuard() as ReturnType<typeof of>;
    (resultado as any).subscribe((permitido: boolean) => {
      expect(permitido).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
      done();
    });
  });

  it('redirige a /home si el usuario en memoria todavía es null (no se ha refrescado)', (done) => {
    localStorage.setItem('pawtrack_access', 'token-falso');
    userSubject.next(null);

    const resultado = ejecutarGuard() as ReturnType<typeof of>;
    (resultado as any).subscribe((permitido: boolean) => {
      expect(permitido).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
      done();
    });
  });
});

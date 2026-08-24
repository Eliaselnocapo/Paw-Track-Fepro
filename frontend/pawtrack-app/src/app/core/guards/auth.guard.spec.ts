import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let router: jasmine.SpyObj<Router>;

  const ejecutarGuard = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as any, { url: '/perfil' } as any)
    );

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }],
    });
  });

  afterEach(() => {
    localStorage.removeItem('pawtrack_access');
  });

  it('deja pasar si hay token guardado', () => {
    localStorage.setItem('pawtrack_access', 'token-falso');

    expect(ejecutarGuard()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirige a /login con returnUrl si no hay token', () => {
    localStorage.removeItem('pawtrack_access');

    expect(ejecutarGuard()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/perfil' },
    });
  });
});

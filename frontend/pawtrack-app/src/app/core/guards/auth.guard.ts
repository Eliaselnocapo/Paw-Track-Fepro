import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const haySesion = !!localStorage.getItem('pawtrack_access');

  if (!haySesion) {
    // Guarda a dónde iba para volver ahí después del login.
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  return true;
};
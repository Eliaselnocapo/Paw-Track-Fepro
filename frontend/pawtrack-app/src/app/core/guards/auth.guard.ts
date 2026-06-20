import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('pawtrack_access');

  if (token) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

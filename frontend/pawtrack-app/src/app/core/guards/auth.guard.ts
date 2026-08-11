// core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const haySesion = !!localStorage.getItem('pawtrack_access');

  if (!haySesion) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const haySesion = !!localStorage.getItem('pawtrack_access');
  if (!haySesion) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  return authService.user$.pipe(
    take(1),
    map((usuario: any) => {
      if (usuario?.is_staff) {
        return true;
      }
      router.navigate(['/home']);
      return false;
    })
  );
};
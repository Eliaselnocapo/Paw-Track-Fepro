import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        toast.mostrar('Sin conexión a internet. Revisa tu red.', 'error');
      } else if (error.status === 401) {
        localStorage.removeItem('pawtrack_access');
        router.navigate(['/login']);
      } else if (error.status >= 500) {
        toast.mostrar('Hubo un problema en el servidor. Intenta de nuevo en un momento.', 'error');
      }
      return throwError(() => error);
    })
  );
};
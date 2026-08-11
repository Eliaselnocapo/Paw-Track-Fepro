import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { environment } from 'src/environments/environment';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo mostramos toasts para errores de NUESTRO backend. Servicios
      // externos (Overpass, Google, etc.) manejan su propio error en el
      // componente que los llama — un 504 de Overpass no es "el servidor
      // de PawTrack falló", y no debe alarmar al usuario con ese mensaje.
      const esNuestraApi = req.url.startsWith(environment.apiUrl);

      if (!esNuestraApi) {
        return throwError(() => error);
      }

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
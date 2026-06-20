import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'reports/create-report',
    loadComponent: () => import('./features/reports/create-report/create-report.page').then( m => m.CreateReportPage)
  },
  {
    path: 'view-report/:folio',
    loadComponent: () => import('./features/reports/view-report/view-report.page').then( m => m.ViewReportComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.page').then( m => m.ProfilePage),
    canActivate: [authGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'reports/:folio/update',
    loadComponent: () =>
      import('./features/reports/update-report/update-report.page')
        .then(m => m.UpdateReportPage),
    canActivate: [authGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.page').then( m => m.RegisterPage)
  },
  {
    path: 'dashboard/reporter',
    loadComponent: () =>
      import('./features/dashboards/reporter/reporter.page').then(
        (m) => m.ReporterPage
      ),
    canActivate: [authGuard]
  },
  {
    path: 'dashboard/volunteer',
    loadComponent: () =>
      import('./features/dashboards/volunteer/volunteer.page').then(
        (m) => m.VolunteerPage
      ),
    canActivate: [authGuard]
  },
];

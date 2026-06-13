import { Routes } from '@angular/router';

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
    path: 'view-report',
    loadComponent: () => import('./features/reports/view-report/view-report.page').then( m => m.ViewReportPage)
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.page').then( m => m.ProfilePage)
  },

];

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'reports/create-report',
    loadComponent: () =>
      import('./features/reports/reporter-actions/create-report/create-report.page').then(
        (m) => m.CreateReportPage
      ),
  },
  {
    path: 'view-report/:folio',
    loadComponent: () =>
      import('./features/reports/reporter-actions/view-report/view-report.page').then(
        (m) => m.ViewReportComponent
      ),
  },

  // VERDADERO UPDATE: editar datos base del reporte
  {
    path: 'reports/:folio/update',
    loadComponent: () =>
      import('./features/reports/reporter-actions/update-report/update-report.page').then(
        (m) => m.UpdateReportPage
      ),
  },

  // SEGUIMIENTO: agregar más información al historial del caso
  {
    path: 'reports/:folio/follow-up',
    loadComponent: () =>
      import('./features/reports/reporter-actions/follow-up-report/follow-up-report.page').then(
        (m) => m.FollowUpReportPage
      ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile-page/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.page').then(
        (m) => m.RegisterPage
      ),
  },
  {
    path: 'dashboard/reporter',
    loadComponent: () =>
      import('./features/dashboards/reporter/reporter.page').then(
        (m) => m.ReporterPage
      ),
  },
  {
    path: 'dashboard/volunteer',
    loadComponent: () =>
      import('./features/dashboards/volunteer/volunteer.page').then(
        (m) => m.VolunteerPage
      ),
  },
  {
    path: 'mapa',
    loadComponent: () =>
      import('./features/mapa-general/mapa-general.component').then(
        (m) => m.MapaGeneralComponent
      ),
  },
  {
    path: 'accepted-cases',
    loadComponent: () => import('./features/reports/volunteer-actions/accepted-cases/accepted-cases.page').then( m => m.AcceptedCasesPage)
  },
  {
    path: 'accept-case/:folio',
    loadComponent: () => import('./features/reports/volunteer-actions/accept-case/accept-case.page').then( m => m.AcceptCasePage)
  },
  {
    path: 'cronology-case/:folio',
    loadComponent: () => import('./features/reports/volunteer-actions/cronology-case/cronology-case.page').then( m => m.CronologyCasePage)
  },
  {
    path: 'details-case/:folio',
    loadComponent: () => import('./features/reports/volunteer-actions/details-case/details-case.page').then( m => m.DetailsCasePage)
  },
  {
    path: 'details-case-accepted/:folio',
    loadComponent: () => import('./features/reports/volunteer-actions/details-case-accepted/details-case-accepted.page').then( m => m.DetailsCaseAcceptedPage)
  },
  {
    path: 'update-case/:folio',
    loadComponent: () => import('./features/reports/volunteer-actions/update-case/update-case.page').then(m => m.UpdateCasePage)
  },
  {
    path: 'dashboard/reports/history',
    loadComponent: () => import('./features/reports/reporter-actions/reports-history/reports-history.page').then( m => m.ReportsHistory)
  },
  {
  path: 'case-accepted-success',
  loadComponent: () =>
    import('./features/reports/volunteer-actions/case-accepted-success/case-accepted-success.page')
      .then(m => m.CaseAcceptedSuccessPage),
  },
  {
  path: 'view-follow-up/:folio',
  loadComponent: () => import('./features/reports/reporter-actions/view-follow-up/view-follow-up.page').then(m => m.ViewFollowUpPage)
  },
  {
  path: 'rescue-complete/:folio',
  loadComponent: () => import('./features/reports/volunteer-actions/rescue-complete/rescue-complete.page').then(m => m.RescueCompletePage)
  },
  {
  path: 'edit-profile',
  loadComponent: () =>
    import('./features/profile/edit-profile/edit-profile.page').then(m => m.EditProfilePage),
  },
  {
  path: 'app-coming-soon',
  loadComponent: () =>
    import('./features/coming-soon/cooming-soon.page').then(m => m.ComingSoonPage),
  },
];

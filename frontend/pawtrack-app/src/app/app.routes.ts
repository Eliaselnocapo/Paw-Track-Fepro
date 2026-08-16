import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [

  // ═══════════════════════════════════════════════════════════════════════════
  // PÚBLICAS
  //
  // Un invitado puede reportar un animal y consultar casos sin cuenta: exigir
  // registro en una emergencia haría que el animal pierda tiempo. El reporte
  // anónimo se reclama después con el cartel PDF.
  // ═══════════════════════════════════════════════════════════════════════════

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
  {
    path: 'dashboard/reporter',
    loadComponent: () =>
      import('./features/dashboards/reporter/reporter.page').then(
        (m) => m.ReporterPage
      ),
  },
  {
    // Pública a propósito: la lista de casos disponibles se ve sin cuenta.
    // aceptarMision() ya redirige al login cuando hace falta.
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
    path: 'details-case/:folio',
    loadComponent: () =>
      import('./features/reports/volunteer-actions/details-case/details-case.page')
        .then((m) => m.DetailsCasePage),
  },
  {
    path: 'patrocinadores',
    loadComponent: () =>
      import('./features/patrocinadores/patrocinadores.page')
        .then((m) => m.PatrocinadoresPage),
  },
  {
    // Perfil público de un centro: es su carta de presentación, tiene que
    // poder verse y compartirse sin cuenta.
    path: 'centro/:id',
    loadComponent: () =>
      import('./features/profile/center-profile/center-profile.page')
        .then((m) => m.PerfilCentroPage),
  },
  {
    path: 'app-coming-soon',
    loadComponent: () =>
      import('./features/coming-soon/cooming-soon.page').then((m) => m.ComingSoonPage),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUIEREN SESIÓN — perfil del usuario
  // ═══════════════════════════════════════════════════════════════════════════

  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile-page/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'edit-profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/edit-profile/edit-profile.page').then((m) => m.EditProfilePage),
  },
  {
    path: 'reputation',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/reputation/reputation.page').then((m) => m.ReputationPage),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUIEREN SESIÓN — gestión de reportes propios
  // ═══════════════════════════════════════════════════════════════════════════

  {
    path: 'reports/:folio/update',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/reporter-actions/update-report/update-report.page').then(
        (m) => m.UpdateReportPage
      ),
  },
  {
    path: 'reports/:folio/follow-up',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/reporter-actions/follow-up-report/follow-up-report.page').then(
        (m) => m.FollowUpReportPage
      ),
  },
  {
    path: 'view-follow-up/:folio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/reporter-actions/view-follow-up/view-follow-up.page')
        .then((m) => m.ViewFollowUpPage),
  },
  {
    path: 'dashboard/reports/history',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/reporter-actions/reports-history/reports-history.page')
        .then((m) => m.ReportsHistory),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUIEREN SESIÓN — acciones de voluntario
  //
  // El backend ya valida propiedad en cada endpoint (PermissionDenied si el
  // rescate no es tuyo). Estos guards evitan que la pantalla se cargue en
  // vano, no sustituyen esa validación.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    path: 'accepted-cases',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/volunteer-actions/accepted-cases/accepted-cases.page')
        .then((m) => m.AcceptedCasesPage),
  },
  {
    path: 'accept-case/:folio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/volunteer-actions/accept-case/accept-case.page')
        .then((m) => m.AcceptCasePage),
  },
  {
    path: 'update-case/:folio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/volunteer-actions/update-case/update-case.page')
        .then((m) => m.UpdateCasePage),
  },
  {
    path: 'cronology-case/:folio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/volunteer-actions/cronology-case/cronology-case.page')
        .then((m) => m.CronologyCasePage),
  },
  {
    path: 'details-case-accepted/:folio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/volunteer-actions/details-case-accepted/details-case-accepted.page')
        .then((m) => m.DetailsCaseAcceptedPage),
  },
  {
    path: 'case-accepted-success',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/volunteer-actions/case-accepted-success/case-accepted-success.page')
        .then((m) => m.CaseAcceptedSuccessPage),
  },
  {
    path: 'rescue-complete/:folio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/volunteer-actions/rescue-complete/rescue-complete.page')
        .then((m) => m.RescueCompletePage),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUIEREN SESIÓN — centros de apoyo
  // ═══════════════════════════════════════════════════════════════════════════

  {
    path: 'registrar-centro',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/register-center/register-center.page')
        .then((m) => m.RegisterCenterPage),
  },
  {
    path: 'mi-centro',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/patrocinadores/center-dashboard/center-dashboard.page')
        .then((m) => m.CenterDashboardPage),
  },

];
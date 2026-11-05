import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', title: 'Iniciar sesión', canActivate: [guestGuard], loadComponent: () => import('./pages/login').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Resumen', loadComponent: () => import('./pages/dashboard').then(m => m.DashboardPage) },
      { path: 'movimientos', title: 'Movimientos', loadComponent: () => import('./pages/transactions').then(m => m.TransactionsPage) },
      { path: 'gastos-fijos', title: 'Gastos fijos', loadComponent: () => import('./pages/fixed-expenses').then(m => m.FixedExpensesPage) },
      { path: 'deudas', title: 'Deudas', loadComponent: () => import('./pages/debts').then(m => m.DebtsPage) },
      { path: 'ahorro', title: 'Ahorro', loadComponent: () => import('./pages/savings').then(m => m.SavingsPage) },
      { path: 'presupuestos', title: 'Presupuestos', loadComponent: () => import('./pages/budgets').then(m => m.BudgetsPage) },
      { path: 'reportes', title: 'Reportes', loadComponent: () => import('./pages/reports').then(m => m.ReportsPage) },
      { path: 'usuarios', title: 'Usuarios', canActivate: [adminGuard], loadComponent: () => import('./pages/users').then(m => m.UsersPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];

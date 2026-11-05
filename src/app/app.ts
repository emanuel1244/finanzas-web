import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ROLE_LABELS } from './core/api';
import { AuthService } from './core/auth';
import { ChangePassword } from './core/change-password';
import { Icon } from './core/icon';

type Theme = 'light' | 'dark';
const THEME_KEY = 'finanzas-theme';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ChangePassword],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly auth = inject(AuthService);

  private readonly baseLinks = [
    { path: '/dashboard', label: 'Resumen', icon: 'dashboard' },
    { path: '/movimientos', label: 'Movimientos', icon: 'swap' },
    { path: '/gastos-fijos', label: 'Gastos fijos', icon: 'receipt' },
    { path: '/presupuestos', label: 'Presupuestos', icon: 'target' },
    { path: '/deudas', label: 'Deudas', icon: 'card' },
    { path: '/ahorro', label: 'Ahorro', icon: 'wallet' },
    { path: '/reportes', label: 'Reportes', icon: 'chart' },
  ];

  /** El menú de usuarios solo aparece para administradores. */
  protected readonly links = computed(() =>
    this.auth.isAdmin() ? [...this.baseLinks, { path: '/usuarios', label: 'Usuarios', icon: 'users' }] : this.baseLinks);

  protected readonly roleLabel = computed(() => {
    const r = this.auth.user()?.role;
    return r ? ROLE_LABELS[r] : '';
  });

  protected readonly initials = computed(() => {
    const name = this.auth.user()?.name ?? '';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
  });

  protected readonly changingPassword = signal(false);
  protected readonly theme = signal<Theme>(this.initialTheme());

  constructor() {
    effect(() => {
      const t = this.theme();
      document.documentElement.dataset['theme'] = t;
      try { localStorage.setItem(THEME_KEY, t); } catch { /* almacenamiento no disponible */ }
    });
  }

  protected toggleTheme() { this.theme.update(t => (t === 'dark' ? 'light' : 'dark')); }

  protected logout() { this.auth.logout(); }

  private initialTheme(): Theme {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* ignorar */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}

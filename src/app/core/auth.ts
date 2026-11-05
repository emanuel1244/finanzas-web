import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { API_URL, UserAccount } from './api';

interface Session { token: string; expiresAt: string; user: UserAccount; }

const SESSION_KEY = 'finanzas-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private session = signal<Session | null>(this.restore());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAdmin = computed(() => this.user()?.role === 'Admin');

  async login(email: string, password: string) {
    this.save(await this.post<Session>('login', { email, password }));
  }

  async register(name: string, email: string, password: string) {
    this.save(await this.post<Session>('register', { name, email, password }));
  }

  async changePassword(currentPassword: string, newPassword: string) {
    await this.post<void>('change-password', { currentPassword, newPassword });
  }

  logout(redirect = true) {
    this.session.set(null);
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignorar */ }
    if (redirect) this.router.navigateByUrl('/login');
  }

  private post<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.post<T>(`${API_URL}/auth/${path}`, body));
  }

  private save(s: Session) {
    this.session.set(s);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignorar */ }
  }

  private restore(): Session | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return s.token && new Date(s.expiresAt).getTime() > Date.now() ? s : null;
    } catch {
      return null;
    }
  }
}

/** Agrega el token a las llamadas a la API y cierra la sesión si el servidor responde 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!req.url.startsWith(API_URL)) return next(req);

  const token = auth.token();
  const authorized = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  const isCredentialCall = req.url.endsWith('/auth/login') || req.url.endsWith('/auth/register');

  return next(authorized).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && !isCredentialCall && auth.user()) auth.logout();
      return throwError(() => e);
    }),
  );
};

export const authGuard: CanActivateFn = () =>
  inject(AuthService).user() ? true : inject(Router).createUrlTree(['/login']);

export const adminGuard: CanActivateFn = () =>
  inject(AuthService).isAdmin() ? true : inject(Router).createUrlTree(['/dashboard']);

export const guestGuard: CanActivateFn = () =>
  inject(AuthService).user() ? inject(Router).createUrlTree(['/dashboard']) : true;

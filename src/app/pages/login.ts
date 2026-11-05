import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errMsg } from '../core/api';
import { AuthService } from '../core/auth';
import { Icon } from '../core/icon';

@Component({
  selector: 'app-login',
  imports: [FormsModule, Icon],
  template: `
    <div class="auth">
      <aside class="hero">
        <div class="brand">
          <span class="logo" aria-hidden="true"><app-icon name="wallet" [size]="24" /></span>
          <span>Mis Finanzas</span>
        </div>
        <div class="pitch">
          <h1>Tu dinero,<br />bajo control.</h1>
          <p>Registra ingresos y gastos, controla deudas, presupuestos y metas de ahorro en un solo lugar.</p>
          <ul>
            <li><app-icon name="check" [size]="18" /> Resumen mensual de lo que te queda disponible</li>
            <li><app-icon name="check" [size]="18" /> Presupuestos con alertas por categoría</li>
            <li><app-icon name="check" [size]="18" /> Tus datos son privados: solo tú los ves</li>
          </ul>
        </div>
      </aside>

      <main class="panel">
        <div class="box">
          <div class="tabs" role="tablist" aria-label="Acceso">
            <button type="button" role="tab" [attr.aria-selected]="mode() === 'login'" [class.active]="mode() === 'login'" (click)="setMode('login')">Iniciar sesión</button>
            <button type="button" role="tab" [attr.aria-selected]="mode() === 'register'" [class.active]="mode() === 'register'" (click)="setMode('register')">Crear cuenta</button>
          </div>

          <h2>{{ mode() === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta' }}</h2>
          <p class="sub">{{ mode() === 'login' ? 'Ingresa tus datos para continuar.' : 'Es gratis y toma menos de un minuto.' }}</p>

          @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }

          <form (ngSubmit)="submit()" autocomplete="on">
            @if (mode() === 'register') {
              <label>Nombre
                <span class="field"><app-icon name="user" [size]="18" />
                  <input name="name" autocomplete="name" maxlength="100" [(ngModel)]="form.name" required /></span>
              </label>
            }
            <label>Correo electrónico
              <span class="field"><app-icon name="mail" [size]="18" />
                <input name="email" type="email" autocomplete="username" maxlength="254" [(ngModel)]="form.email" required /></span>
            </label>
            <label>Contraseña
              <span class="field"><app-icon name="lock" [size]="18" />
                <input name="password" [type]="show() ? 'text' : 'password'" maxlength="100"
                       [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
                       [(ngModel)]="form.password" required />
                <button type="button" class="eye" (click)="show.set(!show())"
                        [attr.aria-label]="show() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                  <app-icon [name]="show() ? 'eye-off' : 'eye'" [size]="18" />
                </button>
              </span>
            </label>
            @if (mode() === 'register') {
              <p class="hint">Mínimo 8 caracteres, con letras y números.</p>
            }

            <button type="submit" class="submit" [disabled]="loading()">
              {{ loading() ? 'Un momento...' : (mode() === 'login' ? 'Entrar' : 'Crear cuenta') }}
            </button>
          </form>
        </div>
      </main>
    </div>
  `,
  styles: `
    .auth { min-height: 100vh; display: grid; grid-template-columns: 1.05fr 1fr; background: var(--bg); }

    .hero {
      display: flex; flex-direction: column; justify-content: space-between; gap: 40px;
      padding: 44px 56px; color: #fff;
      background:
        radial-gradient(900px 500px at 10% 0%, rgba(168, 85, 247, .55), transparent 60%),
        radial-gradient(700px 500px at 100% 100%, rgba(59, 130, 246, .45), transparent 60%),
        linear-gradient(160deg, #1e1b4b, #0b1020);
    }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 1.15rem; }
    .logo { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #a855f7); box-shadow: 0 8px 22px rgba(99, 102, 241, .5); }
    .pitch h1 { font-size: 2.8rem; line-height: 1.1; letter-spacing: -.03em; font-weight: 800; }
    .pitch p { margin: 16px 0 26px; max-width: 460px; color: #c7cdf0; font-size: 1.05rem; }
    .pitch ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; color: #e3e7ff; }
    .pitch li { display: flex; align-items: center; gap: 10px; }
    .pitch li app-icon { color: #34d399; }

    .panel { display: grid; place-items: center; padding: 32px 20px; }
    .box { width: 100%; max-width: 420px; }

    .tabs { display: flex; gap: 4px; padding: 4px; background: var(--track); border-radius: 12px; margin-bottom: 28px; }
    .tabs button { flex: 1; background: transparent; color: var(--muted); box-shadow: none; padding: 9px 12px; border-radius: 9px; }
    .tabs button:hover { filter: none; box-shadow: none; color: var(--text); }
    .tabs button.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }

    h2 { font-size: 1.7rem; }
    .sub { color: var(--muted); margin: 4px 0 22px; }
    form { display: flex; flex-direction: column; gap: 16px; }

    .field { position: relative; display: flex; align-items: center; }
    .field app-icon { position: absolute; left: 13px; color: var(--muted); pointer-events: none; }
    .field input { width: 100%; padding: 12px 44px 12px 42px; font-size: 1rem; }
    .eye { position: absolute; right: 6px; padding: 7px; background: transparent; color: var(--muted); box-shadow: none; }
    .eye:hover { filter: none; box-shadow: none; color: var(--text); }
    .hint { color: var(--muted); font-size: .85rem; margin: -6px 0 0; }
    .submit { margin-top: 6px; padding: 13px; font-size: 1rem; }
    .submit:disabled { opacity: .7; cursor: progress; }

    @media (max-width: 860px) {
      .auth { grid-template-columns: 1fr; }
      .hero { padding: 24px; gap: 14px; }
      .pitch { display: none; }
    }
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  mode = signal<'login' | 'register'>('login');
  show = signal(false);
  loading = signal(false);
  error = signal('');
  form = { name: '', email: '', password: '' };

  setMode(m: 'login' | 'register') {
    this.mode.set(m);
    this.error.set('');
  }

  async submit() {
    const f = this.form;
    if (!f.email.trim() || !f.password || (this.mode() === 'register' && !f.name.trim())) {
      this.error.set('Completa todos los campos.');
      return;
    }
    this.loading.set(true);
    try {
      if (this.mode() === 'login') await this.auth.login(f.email.trim(), f.password);
      else await this.auth.register(f.name.trim(), f.email.trim(), f.password);
      this.form.password = '';
      await this.router.navigateByUrl('/dashboard');
    } catch (e) {
      this.error.set(errMsg(e));
    } finally {
      this.loading.set(false);
    }
  }
}

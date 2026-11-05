import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ROLE_LABELS, Role, UserAccount, errMsg } from '../core/api';
import { AuthService } from '../core/auth';
import { Icon } from '../core/icon';
import { Modal } from '../core/modal';

@Component({
  selector: 'app-users',
  imports: [FormsModule, DatePipe, Modal, Icon],
  template: `
    <div class="page-head">
      <div>
        <h2>Usuarios</h2>
        <p class="sub">Administra quién puede entrar y con qué rol.</p>
      </div>
      <div class="actions">
        <button type="button" (click)="openNew()"><app-icon name="plus" [size]="18" /> Nuevo usuario</button>
      </div>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }
    @if (notice()) { <div class="notice" role="status"><app-icon name="check" [size]="18" /> {{ notice() }}</div> }

    <div class="grid">
      <div class="card kpi"><span class="chip"><app-icon name="users" /></span>
        <div><div class="label">Usuarios</div><div class="value">{{ items().length }}</div></div></div>
      <div class="card kpi"><span class="chip warn"><app-icon name="shield" /></span>
        <div><div class="label">Administradores</div><div class="value">{{ adminCount() }}</div></div></div>
      <div class="card kpi"><span class="chip info"><app-icon name="user" /></span>
        <div><div class="label">Clientes</div><div class="value">{{ items().length - adminCount() }}</div></div></div>
    </div>

    <div class="card table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Creado</th><th></th></tr></thead>
        <tbody>
          @for (u of items(); track u.id) {
            <tr>
              <td><strong>{{ u.name }}</strong> @if (u.id === me()?.id) { <span class="badge">Tú</span> }</td>
              <td class="muted">{{ u.email }}</td>
              <td><span class="badge" [class.warn]="u.role === 'Admin'">{{ roleLabel(u.role) }}</span></td>
              <td><span class="badge" [class.ok]="u.isActive" [class.bad]="!u.isActive">{{ u.isActive ? 'Activo' : 'Desactivado' }}</span></td>
              <td class="muted">{{ u.createdAt | date: 'dd/MM/yyyy' }}</td>
              <td class="actions">
                <button class="secondary small icon-only" (click)="edit(u)" aria-label="Editar usuario"><app-icon name="pencil" [size]="16" /></button>
                <button class="secondary small icon-only" (click)="openReset(u)" aria-label="Restablecer contraseña"><app-icon name="key" [size]="16" /></button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6"><div class="empty-state"><span class="chip"><app-icon name="users" [size]="26" /></span>No hay usuarios.</div></td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (formOpen()) {
      <app-modal [title]="editingId() ? 'Editar usuario' : 'Nuevo usuario'" (closed)="closeForm()">
        <form (ngSubmit)="save()">
          @if (formError()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ formError() }}</div> }
          <div class="form-grid">
            <label style="grid-column:1/-1">Nombre <input name="name" maxlength="100" [(ngModel)]="form.name" required /></label>
            @if (!editingId()) {
              <label style="grid-column:1/-1">Correo electrónico <input name="email" type="email" maxlength="254" [(ngModel)]="form.email" required /></label>
              <label style="grid-column:1/-1">Contraseña inicial
                <input name="password" type="password" autocomplete="new-password" maxlength="100" [(ngModel)]="form.password" required />
              </label>
            }
            <label>Rol
              <select name="role" [(ngModel)]="form.role" [disabled]="editingSelf()">
                <option value="Client">Cliente</option>
                <option value="Admin">Administrador</option>
              </select>
            </label>
            @if (editingId()) {
              <label class="check"><input name="active" type="checkbox" [(ngModel)]="form.isActive" [disabled]="editingSelf()" /> Cuenta activa</label>
            }
          </div>
          @if (editingSelf()) {
            <p class="muted small-text modal-note">No puedes cambiar tu propio rol ni desactivar tu cuenta.</p>
          } @else if (!editingId()) {
            <p class="muted small-text modal-note">Mínimo 8 caracteres, con letras y números. El usuario puede cambiarla luego.</p>
          }
          <div class="modal-actions">
            <button type="button" class="ghost" (click)="closeForm()">Cancelar</button>
            <button type="submit"><app-icon name="check" [size]="18" /> {{ editingId() ? 'Guardar cambios' : 'Crear usuario' }}</button>
          </div>
        </form>
      </app-modal>
    }

    @if (resetting(); as r) {
      <app-modal [title]="'Restablecer contraseña de ' + r.name" (closed)="resetting.set(null)">
        <form (ngSubmit)="doReset(r)">
          @if (formError()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ formError() }}</div> }
          <label>Nueva contraseña
            <input name="newPassword" type="password" autocomplete="new-password" maxlength="100" [(ngModel)]="newPassword" required />
          </label>
          <p class="muted small-text modal-note">Mínimo 8 caracteres, con letras y números.</p>
          <div class="modal-actions">
            <button type="button" class="ghost" (click)="resetting.set(null)">Cancelar</button>
            <button type="submit"><app-icon name="key" [size]="18" /> Restablecer</button>
          </div>
        </form>
      </app-modal>
    }
  `,
  styles: `
    .notice {
      display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding: 12px 16px; font-weight: 500;
      border-radius: var(--radius-sm); background: var(--ok-soft); color: var(--ok);
      border: 1px solid color-mix(in srgb, var(--ok) 30%, transparent);
    }
  `,
})
export class UsersPage {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  me = this.auth.user;
  items = signal<UserAccount[]>([]);
  editingId = signal<number | null>(null);
  formOpen = signal(false);
  resetting = signal<UserAccount | null>(null);
  error = signal('');
  notice = signal('');
  formError = signal('');

  adminCount = computed(() => this.items().filter(u => u.role === 'Admin').length);
  editingSelf = computed(() => this.editingId() !== null && this.editingId() === this.me()?.id);

  form = this.emptyForm();
  newPassword = '';

  constructor() { this.load(); }

  private emptyForm() {
    return { name: '', email: '', password: '', role: 'Client' as Role, isActive: true };
  }

  roleLabel(r: Role) { return ROLE_LABELS[r]; }

  async load() {
    try { this.items.set(await this.api.users()); } catch (e) { this.error.set(errMsg(e)); }
  }

  openNew() { this.editingId.set(null); this.form = this.emptyForm(); this.formError.set(''); this.formOpen.set(true); }

  edit(u: UserAccount) {
    this.editingId.set(u.id);
    this.form = { name: u.name, email: u.email, password: '', role: u.role, isActive: u.isActive };
    this.formError.set('');
    this.formOpen.set(true);
  }

  closeForm() { this.formOpen.set(false); this.editingId.set(null); this.form = this.emptyForm(); this.formError.set(''); }

  async save() {
    const f = this.form;
    const id = this.editingId();
    if (!f.name.trim() || (!id && (!f.email.trim() || !f.password))) { this.formError.set('Completa los campos obligatorios.'); return; }
    try {
      if (id) await this.api.updateUser(id, { name: f.name, role: f.role, isActive: f.isActive });
      else await this.api.createUser({ name: f.name, email: f.email, password: f.password, role: f.role });
      this.error.set('');
      this.notice.set(id ? 'Usuario actualizado.' : 'Usuario creado.');
      this.closeForm();
      await this.load();
    } catch (e) {
      this.formError.set(errMsg(e));
    }
  }

  openReset(u: UserAccount) { this.newPassword = ''; this.formError.set(''); this.resetting.set(u); }

  async doReset(u: UserAccount) {
    if (!this.newPassword) { this.formError.set('Escribe la nueva contraseña.'); return; }
    try {
      await this.api.resetUserPassword(u.id, this.newPassword);
      this.error.set('');
      this.notice.set(`Contraseña de ${u.name} restablecida.`);
      this.resetting.set(null);
    } catch (e) {
      this.formError.set(errMsg(e));
    }
  }
}

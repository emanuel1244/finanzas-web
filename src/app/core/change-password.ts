import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errMsg } from './api';
import { AuthService } from './auth';
import { Icon } from './icon';
import { Modal } from './modal';

/** Modal para que el usuario cambie su propia contraseña. */
@Component({
  selector: 'app-change-password',
  imports: [FormsModule, Modal, Icon],
  template: `
    <app-modal title="Cambiar contraseña" (closed)="closed.emit()">
      @if (done()) {
        <div class="empty-state">
          <span class="chip"><app-icon name="check" [size]="26" /></span>
          Tu contraseña se actualizó correctamente.
        </div>
        <div class="modal-actions"><button type="button" (click)="closed.emit()">Listo</button></div>
      } @else {
        <form (ngSubmit)="save()">
          @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }
          <div class="stack">
            <label>Contraseña actual
              <input name="current" type="password" autocomplete="current-password" maxlength="100" [(ngModel)]="form.current" required />
            </label>
            <label>Nueva contraseña
              <input name="next" type="password" autocomplete="new-password" maxlength="100" [(ngModel)]="form.next" required />
            </label>
            <label>Confirmar nueva contraseña
              <input name="confirm" type="password" autocomplete="new-password" maxlength="100" [(ngModel)]="form.confirm" required />
            </label>
            <p class="muted small-text">Mínimo 8 caracteres, con letras y números.</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost" (click)="closed.emit()">Cancelar</button>
            <button type="submit" [disabled]="saving()"><app-icon name="check" [size]="18" /> Guardar</button>
          </div>
        </form>
      }
    </app-modal>
  `,
})
export class ChangePassword {
  private auth = inject(AuthService);
  closed = output<void>();

  form = { current: '', next: '', confirm: '' };
  error = signal('');
  saving = signal(false);
  done = signal(false);

  async save() {
    const f = this.form;
    if (!f.current || !f.next) { this.error.set('Completa todos los campos.'); return; }
    if (f.next !== f.confirm) { this.error.set('La confirmación no coincide con la nueva contraseña.'); return; }
    this.saving.set(true);
    try {
      await this.auth.changePassword(f.current, f.next);
      this.done.set(true);
      this.error.set('');
    } catch (e) {
      this.error.set(errMsg(e));
    } finally {
      this.saving.set(false);
    }
  }
}

import { Component, input, output } from '@angular/core';
import { Icon } from './icon';
import { Modal } from './modal';

/**
 * Diálogo de confirmación reutilizable, construido sobre `Modal`.
 * Se usa dentro de un `@if` del padre:
 * `@if (confirming()) { <app-confirm-dialog ... (confirmed)="..." (cancelled)="..." /> }`
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal, Icon],
  template: `
    <app-modal [title]="title()" (closed)="cancelled.emit()">
      <div class="confirm">
        <span class="confirm-icon" [class.danger]="danger()" [class.info]="!danger()">
          <app-icon [name]="danger() ? 'alert' : 'alert'" [size]="26" />
        </span>
        <p class="confirm-msg">{{ message() }}</p>
        @if (detail()) { <p class="muted small-text confirm-detail">{{ detail() }}</p> }
      </div>
      <div class="modal-actions">
        <button type="button" class="ghost" (click)="cancelled.emit()">{{ cancelLabel() }}</button>
        <button type="button" [class.danger]="danger()" (click)="confirmed.emit()" [disabled]="busy()">
          @if (busy()) { Procesando… } @else {
            <app-icon [name]="danger() ? 'trash' : 'check'" [size]="18" /> {{ confirmLabel() }}
          }
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .confirm { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; padding: 8px 4px 4px; }
    .confirm-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 60px; height: 60px; border-radius: 50%;
    }
    .confirm-icon.danger { background: var(--bad-soft); color: var(--bad); }
    .confirm-icon.info { background: var(--info-soft); color: var(--info); }
    .confirm-msg { font-size: 1.05rem; font-weight: 600; margin: 0; }
    .confirm-detail { margin: 0; max-width: 42ch; }
  `,
})
export class ConfirmDialog {
  title = input('Confirmar acción');
  message = input.required<string>();
  detail = input<string>('');
  confirmLabel = input('Eliminar');
  cancelLabel = input('Cancelar');
  danger = input(true);
  busy = input(false);

  confirmed = output<void>();
  cancelled = output<void>();
}

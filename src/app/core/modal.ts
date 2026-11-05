import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input, output } from '@angular/core';
import { Icon } from './icon';

let nextId = 0;

/**
 * Ventana modal accesible: se cierra con Escape, con el botón ✕ o al hacer clic fuera.
 * Atrapa el foco con Tab, bloquea el scroll del fondo y devuelve el foco al cerrar.
 * Se usa dentro de un `@if` del padre: `@if (abierto()) { <app-modal title="..." (closed)="...">...</app-modal> }`.
 */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  host: {
    '(document:keydown.escape)': 'closed.emit()',
    '(keydown.tab)': 'trapFocus($event)',
    '(keydown.shift.tab)': 'trapFocus($event)',
  },
  template: `
    <div class="backdrop" (mousedown)="onBackdrop($event)">
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId">
        <header>
          <h3 [id]="titleId">{{ title() }}</h3>
          <button type="button" class="ghost small icon-only" (click)="closed.emit()" aria-label="Cerrar"><app-icon name="x" [size]="18" /></button>
        </header>
        <div class="body"><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed; inset: 0; z-index: 50;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      background: rgba(11, 16, 32, .55);
      backdrop-filter: blur(3px);
      animation: fade .15s ease both;
    }
    .dialog {
      width: 100%; max-width: 620px; max-height: calc(100vh - 40px);
      display: flex; flex-direction: column;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, .35);
      animation: pop .2s cubic-bezier(.2, .8, .2, 1) both;
    }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 24px 0; }
    header h3 { font-size: 1.15rem; }
    .body { padding: 18px 24px 24px; overflow-y: auto; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pop { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
    @media (max-width: 600px) {
      .backdrop { align-items: flex-end; padding: 0; }
      .dialog { max-width: none; border-radius: 20px 20px 0 0; max-height: 92vh; }
      header { padding: 16px 16px 0; }
      .body { padding: 14px 16px 20px; }
    }
  `,
})
export class Modal implements AfterViewInit, OnDestroy {
  title = input.required<string>();
  closed = output<void>();

  protected readonly titleId = `modal-title-${nextId++}`;
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previouslyFocused = document.activeElement as HTMLElement | null;

  ngAfterViewInit() {
    document.body.style.overflow = 'hidden';
    const first = this.host.nativeElement.querySelector<HTMLElement>('.body input, .body select, .body textarea');
    (first ?? this.host.nativeElement.querySelector<HTMLElement>('.dialog button'))?.focus();
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
    this.previouslyFocused?.focus?.();
  }

  protected onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.closed.emit();
  }

  protected trapFocus(e: Event) {
    const focusables = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const shift = (e as KeyboardEvent).shiftKey;
    const active = document.activeElement;
    if (shift && active === first) { e.preventDefault(); last.focus(); }
    else if (!shift && active === last) { e.preventDefault(); first.focus(); }
  }
}

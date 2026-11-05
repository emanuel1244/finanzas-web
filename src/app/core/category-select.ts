import { Component, computed, forwardRef, inject, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ApiService, Category, TxType, errMsg } from './api';
import { Icon } from './icon';

const NEW_VALUE = '__new__';

/**
 * Selector de categoría con la opción "Crear nueva categoría…".
 * Al elegirla aparece un campo para el nombre; se crea en la API (con el tipo indicado),
 * se avisa al padre con `created` y queda seleccionada.
 */
@Component({
  selector: 'app-category-select',
  imports: [Icon],
  template: `
    <select [disabled]="disabled()" (change)="onSelect($event)" [attr.aria-label]="ariaLabel() || null">
      @if (emptyLabel() !== null) { <option value="" [selected]="value() === null">{{ emptyLabel() }}</option> }
      @for (c of sorted(); track c.id) {
        <option [value]="c.id" [selected]="c.id === value()">{{ c.name }}</option>
      }
      <option [value]="newValue">＋ Crear nueva categoría…</option>
    </select>

    @if (creating()) {
      <div class="new">
        <input #name type="text" maxlength="100" placeholder="Nombre de la categoría" aria-label="Nombre de la nueva categoría"
               [value]="newName()" (input)="newName.set(name.value)"
               (keydown.enter)="$event.preventDefault(); create()"
               (keydown.escape)="$event.stopPropagation(); cancel()" />
        <button type="button" class="small" [disabled]="saving()" (click)="create()">
          <app-icon name="check" [size]="15" /> Crear
        </button>
        <button type="button" class="ghost small" (click)="cancel()">Cancelar</button>
      </div>
      @if (error()) { <div class="err" role="alert">{{ error() }}</div> }
    }
  `,
  styles: `
    :host { display: block; }
    select { width: 100%; }
    .new { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    .new input { flex: 1; min-width: 140px; }
    .err { color: var(--bad); font-size: .8rem; font-weight: 500; margin-top: 6px; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CategorySelect), multi: true }],
})
export class CategorySelect implements ControlValueAccessor {
  private api = inject(ApiService);

  categories = input<Category[]>([]);
  /** Tipo con el que se crean las categorías nuevas. */
  type = input<TxType>('Expense');
  /** Texto de la opción vacía (valor null). Si es null no se muestra esa opción. */
  emptyLabel = input<string | null>(null);
  ariaLabel = input('');
  created = output<Category>();

  protected readonly newValue = NEW_VALUE;
  protected value = signal<number | null>(null);
  protected disabled = signal(false);
  protected creating = signal(false);
  protected saving = signal(false);
  protected error = signal('');
  protected newName = signal('');

  protected sorted = computed(() => [...this.categories()].sort((a, b) => a.name.localeCompare(b.name, 'es')));

  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: number | null): void { this.value.set(v ?? null); }
  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected onSelect(e: Event) {
    const el = e.target as HTMLSelectElement;
    this.onTouched();
    if (el.value === NEW_VALUE) {
      // Mantiene visible la selección actual mientras se escribe el nombre.
      el.value = this.value() === null ? '' : String(this.value());
      this.error.set('');
      this.creating.set(true);
      return;
    }
    const v = el.value === '' ? null : Number(el.value);
    this.value.set(v);
    this.onChange(v);
  }

  protected cancel() {
    this.creating.set(false);
    this.newName.set('');
    this.error.set('');
  }

  protected async create() {
    const name = this.newName().trim();
    if (!name) { this.error.set('Escribe un nombre.'); return; }

    const existing = this.categories().find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      this.error.set('Ya existe una categoría con ese nombre.');
      return;
    }

    this.saving.set(true);
    try {
      const cat = await this.api.createCategory({ name, type: this.type() });
      this.created.emit(cat);
      this.value.set(cat.id);
      this.onChange(cat.id);
      this.cancel();
    } catch (e) {
      this.error.set(errMsg(e));
    } finally {
      this.saving.set(false);
    }
  }
}

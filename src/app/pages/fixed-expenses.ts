import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Category, FixedExpense, errMsg } from '../core/api';
import { Icon } from '../core/icon';
import { Modal } from '../core/modal';
import { ConfirmDialog } from '../core/confirm-dialog';
import { CategorySelect } from '../core/category-select';
import { CopPipe, MoneyInput } from '../core/money';

@Component({
  selector: 'app-fixed-expenses',
  imports: [FormsModule, CopPipe, MoneyInput, Modal, ConfirmDialog, CategorySelect, Icon],
  template: `
    <div class="page-head">
      <div>
        <h2>Gastos fijos</h2>
        <p class="sub">Renta, servicios y suscripciones que se repiten cada mes.</p>
      </div>
      <div class="actions">
        <button type="button" (click)="openNew()"><app-icon name="plus" [size]="18" /> Nuevo gasto fijo</button>
      </div>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }

    <div class="grid">
      <div class="card kpi">
        <span class="chip info"><app-icon name="receipt" /></span>
        <div><div class="label">Total mensual (activos)</div><div class="value">$ {{ total() | cop }}</div></div>
      </div>
      <div class="card kpi">
        <span class="chip"><app-icon name="list" /></span>
        <div><div class="label">Gastos activos</div><div class="value">{{ activeCount() }} <span class="muted small-text">de {{ items().length }}</span></div></div>
      </div>
    </div>

    @if (formOpen()) {
      <app-modal [title]="editingId() ? 'Editar gasto fijo' : 'Nuevo gasto fijo'" (closed)="resetForm()">
        <form (ngSubmit)="save()">
          <div class="form-grid">
            <label style="grid-column:1/-1">Nombre <input name="name" maxlength="150" [(ngModel)]="form.name" required /></label>
            <label>Monto <app-money name="amount" [(ngModel)]="form.amount" required /></label>
            <label>Día del mes <input name="day" type="number" min="1" max="31" [(ngModel)]="form.dayOfMonth" required /></label>
            <label>Categoría
              <app-category-select name="category" [(ngModel)]="form.categoryId" emptyLabel="Sin categoría"
                [categories]="categories()" type="Expense" (created)="onCategoryCreated($event)" />
            </label>
            <label class="check"><input name="active" type="checkbox" [(ngModel)]="form.isActive" /> Activo</label>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost" (click)="resetForm()">Cancelar</button>
            <button type="submit"><app-icon name="check" [size]="18" /> {{ editingId() ? 'Guardar cambios' : 'Agregar' }}</button>
          </div>
        </form>
      </app-modal>
    }

    <div class="card table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Categoría</th><th>Día</th><th class="num">Monto</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (f of items(); track f.id) {
            <tr>
              <td><strong>{{ f.name }}</strong></td>
              <td>@if (f.categoryName) { <span class="tag">{{ f.categoryName }}</span> } @else { <span class="muted">—</span> }</td>
              <td class="muted">Día {{ f.dayOfMonth }}</td>
              <td class="num"><strong>$ {{ f.amount | cop }}</strong></td>
              <td><span class="badge" [class.ok]="f.isActive">{{ f.isActive ? 'Activo' : 'Pausado' }}</span></td>
              <td class="actions">
                <button class="secondary small icon-only" (click)="edit(f)" aria-label="Editar gasto fijo"><app-icon name="pencil" [size]="16" /></button>
                <button class="danger small icon-only" (click)="remove(f)" aria-label="Eliminar gasto fijo"><app-icon name="trash" [size]="16" /></button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6">
              <div class="empty-state">
                <span class="chip"><app-icon name="inbox" [size]="26" /></span>
                Aún no registras gastos fijos.
              </div>
            </td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (removing(); as f) {
      <app-confirm-dialog
        title="Eliminar gasto fijo"
        [message]="'¿Eliminar el gasto fijo «' + f.name + '»?'"
        detail="Se quitará de tus gastos recurrentes. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        (confirmed)="confirmRemove(f)"
        (cancelled)="removing.set(null)" />
    }
  `,
})
export class FixedExpensesPage {
  private api = inject(ApiService);

  items = signal<FixedExpense[]>([]);
  categories = signal<Category[]>([]);
  editingId = signal<number | null>(null);
  formOpen = signal(false);
  removing = signal<FixedExpense | null>(null);
  error = signal('');
  total = computed(() => this.items().filter(f => f.isActive).reduce((s, f) => s + f.amount, 0));
  activeCount = computed(() => this.items().filter(f => f.isActive).length);

  form = this.emptyForm();

  constructor() { this.init(); }

  private emptyForm() {
    return { name: '', amount: null as number | null, dayOfMonth: 1, categoryId: null as number | null, isActive: true };
  }

  async init() {
    try {
      this.categories.set((await this.api.categories()).filter(c => c.type === 'Expense'));
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async load() {
    try { this.items.set(await this.api.fixedExpenses()); } catch (e) { this.error.set(errMsg(e)); }
  }

  openNew() { this.resetForm(); this.formOpen.set(true); }

  onCategoryCreated(c: Category) { this.categories.update(list => [...list, c]); }

  edit(f: FixedExpense) {
    this.editingId.set(f.id);
    this.form = { name: f.name, amount: f.amount, dayOfMonth: f.dayOfMonth, categoryId: f.categoryId, isActive: f.isActive };
    this.formOpen.set(true);
  }

  resetForm() { this.editingId.set(null); this.form = this.emptyForm(); this.formOpen.set(false); }

  async save() {
    const f = this.form;
    if (!f.name.trim() || !f.amount) { this.error.set('Completa nombre y monto.'); return; }
    const body = { name: f.name, amount: f.amount, dayOfMonth: f.dayOfMonth, categoryId: f.categoryId, isActive: f.isActive };
    try {
      const id = this.editingId();
      if (id) await this.api.updateFixedExpense(id, body); else await this.api.createFixedExpense(body);
      this.error.set('');
      this.resetForm();
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async remove(f: FixedExpense) { this.removing.set(f); }

  async confirmRemove(f: FixedExpense) {
    try {
      await this.api.deleteFixedExpense(f.id);
      this.removing.set(null);
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); this.removing.set(null); }
  }
}

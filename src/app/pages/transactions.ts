import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Category, Transaction, TxType, currentMonth, errMsg, monthRange, today } from '../core/api';
import { Icon } from '../core/icon';
import { Modal } from '../core/modal';
import { ConfirmDialog } from '../core/confirm-dialog';
import { CategorySelect } from '../core/category-select';
import { CopPipe, MoneyInput } from '../core/money';

@Component({
  selector: 'app-transactions',
  imports: [FormsModule, CopPipe, MoneyInput, Modal, ConfirmDialog, CategorySelect, Icon],
  template: `
    <div class="page-head">
      <div>
        <h2>Movimientos</h2>
        <p class="sub">Ingresos y gastos del día a día.</p>
      </div>
      <div class="actions">
        <label>Mes
          <input type="month" [ngModel]="month()" (ngModelChange)="changeMonth($event)" />
        </label>
        <button type="button" (click)="openNew()"><app-icon name="plus" [size]="18" /> Nuevo movimiento</button>
      </div>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }

    <div class="grid">
      <div class="card kpi">
        <span class="chip ok"><app-icon name="up" /></span>
        <div><div class="label">Ingresos</div><div class="value pos">$ {{ income() | cop }}</div></div>
      </div>
      <div class="card kpi">
        <span class="chip bad"><app-icon name="down" /></span>
        <div><div class="label">Gastos</div><div class="value neg">$ {{ expense() | cop }}</div></div>
      </div>
      <div class="card kpi">
        <span class="chip"><app-icon name="wallet" /></span>
        <div>
          <div class="label">Balance</div>
          <div class="value" [class.pos]="income() - expense() >= 0" [class.neg]="income() - expense() < 0">
            $ {{ income() - expense() | cop }}
          </div>
        </div>
      </div>
    </div>

    @if (formOpen()) {
      <app-modal [title]="editingId() ? 'Editar movimiento' : 'Nuevo movimiento'" (closed)="resetForm()">
        <form (ngSubmit)="save()">
          <div class="form-grid">
            <label>Tipo
              <select name="type" [ngModel]="type()" (ngModelChange)="changeType($event)">
                <option value="Expense">Gasto</option>
                <option value="Income">Ingreso</option>
              </select>
            </label>
            <label>Categoría
              <app-category-select name="category" [(ngModel)]="form.categoryId" required
                [categories]="filteredCategories()" [type]="type()" (created)="onCategoryCreated($event)" />
            </label>
            <label>Monto
              <app-money name="amount" [(ngModel)]="form.amount" required />
            </label>
            <label>Fecha
              <input name="date" type="date" [(ngModel)]="form.date" required />
            </label>
            <label style="grid-column:1/-1">Descripción
              <input name="description" maxlength="300" [(ngModel)]="form.description" />
            </label>
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
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th class="num">Monto</th><th></th></tr></thead>
        <tbody>
          @for (t of items(); track t.id) {
            <tr>
              <td class="muted">{{ t.date }}</td>
              <td>
                <span class="badge" [class.income]="t.type === 'Income'" [class.expense]="t.type === 'Expense'">
                  <app-icon [name]="t.type === 'Income' ? 'up' : 'down'" [size]="13" />
                  {{ t.type === 'Income' ? 'Ingreso' : 'Gasto' }}
                </span>
              </td>
              <td><span class="tag">{{ t.categoryName }}</span></td>
              <td>{{ t.description }}</td>
              <td class="num" [class.pos]="t.type === 'Income'" [class.neg]="t.type === 'Expense'">
                <strong>{{ t.type === 'Income' ? '+' : '−' }} $ {{ t.amount | cop }}</strong>
              </td>
              <td class="actions">
                <button class="secondary small icon-only" (click)="edit(t)" aria-label="Editar movimiento"><app-icon name="pencil" [size]="16" /></button>
                <button class="danger small icon-only" (click)="remove(t)" aria-label="Eliminar movimiento"><app-icon name="trash" [size]="16" /></button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6">
              <div class="empty-state">
                <span class="chip"><app-icon name="inbox" [size]="26" /></span>
                No hay movimientos en este mes.
              </div>
            </td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (removing(); as t) {
      <app-confirm-dialog
        title="Eliminar movimiento"
        [message]="'¿Eliminar «' + (t.description || t.categoryName) + '»?'"
        [detail]="(t.type === 'Income' ? 'Ingreso' : 'Gasto') + ' de $ ' + (t.amount | cop) + ' del ' + t.date + '. Esta acción no se puede deshacer.'"
        confirmLabel="Sí, eliminar"
        (confirmed)="confirmRemove(t)"
        (cancelled)="removing.set(null)" />
    }
  `,
})
export class TransactionsPage {
  private api = inject(ApiService);

  month = signal(currentMonth());
  items = signal<Transaction[]>([]);
  categories = signal<Category[]>([]);
  type = signal<TxType>('Expense');
  editingId = signal<number | null>(null);
  formOpen = signal(false);
  removing = signal<Transaction | null>(null);
  error = signal('');
  filteredCategories = computed(() => this.categories().filter(c => c.type === this.type()));
  income = computed(() => this.items().filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0));
  expense = computed(() => this.items().filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0));

  form = this.emptyForm();

  constructor() { this.init(); }

  private emptyForm() {
    return { categoryId: null as number | null, amount: null as number | null, date: today(), description: '' };
  }

  async init() {
    try {
      this.categories.set(await this.api.categories());
      this.form.categoryId = this.filteredCategories()[0]?.id ?? null;
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async load() {
    try {
      const { from, to } = monthRange(this.month());
      this.items.set(await this.api.transactions(from, to));
    } catch (e) { this.error.set(errMsg(e)); }
  }

  changeMonth(v: string) { if (v) { this.month.set(v); this.load(); } }

  onCategoryCreated(c: Category) { this.categories.update(list => [...list, c]); }

  changeType(t: TxType) {
    this.type.set(t);
    this.form.categoryId = this.filteredCategories()[0]?.id ?? null;
  }

  openNew() { this.resetForm(); this.formOpen.set(true); }

  edit(t: Transaction) {
    this.type.set(t.type);
    this.editingId.set(t.id);
    this.form = { categoryId: t.categoryId, amount: t.amount, date: t.date, description: t.description ?? '' };
    this.formOpen.set(true);
  }

  resetForm() {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.form.categoryId = this.filteredCategories()[0]?.id ?? null;
    this.formOpen.set(false);
  }

  async save() {
    const f = this.form;
    if (f.categoryId == null || !f.amount || !f.date) { this.error.set('Completa categoría, monto y fecha.'); return; }
    const body = { categoryId: f.categoryId, amount: f.amount, date: f.date, description: f.description || null };
    try {
      const id = this.editingId();
      if (id) await this.api.updateTransaction(id, body); else await this.api.createTransaction(body);
      this.error.set('');
      this.resetForm();
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async remove(t: Transaction) { this.removing.set(t); }

  async confirmRemove(t: Transaction) {
    try {
      await this.api.deleteTransaction(t.id);
      this.removing.set(null);
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); this.removing.set(null); }
  }
}

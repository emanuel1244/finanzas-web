import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, BudgetState, BudgetStatus, Category, currentMonth, errMsg } from '../core/api';
import { Icon } from '../core/icon';
import { Modal } from '../core/modal';
import { ConfirmDialog } from '../core/confirm-dialog';
import { CategorySelect } from '../core/category-select';
import { CopPipe, MoneyInput } from '../core/money';

const STATE_LABEL: Record<BudgetState, string> = { Ok: 'En orden', Warning: 'Cerca del límite', Exceeded: 'Excedido' };

@Component({
  selector: 'app-budgets',
  imports: [FormsModule, DecimalPipe, CopPipe, MoneyInput, Modal, ConfirmDialog, CategorySelect, Icon],
  template: `
    <div class="page-head">
      <div>
        <h2>Presupuestos</h2>
        <p class="sub">Define un límite mensual por categoría y controla cuánto llevas.</p>
      </div>
      <div class="actions">
        <label>Mes
          <input type="month" [ngModel]="month()" (ngModelChange)="changeMonth($event)" />
        </label>
        <button type="button" (click)="openNew()"><app-icon name="plus" [size]="18" /> Nuevo presupuesto</button>
      </div>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }

    <div class="grid">
      <div class="card kpi">
        <span class="chip"><app-icon name="target" /></span>
        <div><div class="label">Presupuestado</div><div class="value">$ {{ totalLimit() | cop }}</div></div>
      </div>
      <div class="card kpi">
        <span class="chip bad"><app-icon name="down" /></span>
        <div><div class="label">Gastado</div><div class="value">$ {{ totalSpent() | cop }}</div></div>
      </div>
      <div class="card kpi">
        <span class="chip" [class.ok]="totalLimit() - totalSpent() >= 0" [class.bad]="totalLimit() - totalSpent() < 0"><app-icon name="wallet" /></span>
        <div>
          <div class="label">Disponible</div>
          <div class="value" [class.pos]="totalLimit() - totalSpent() >= 0" [class.neg]="totalLimit() - totalSpent() < 0">
            $ {{ totalLimit() - totalSpent() | cop }}
          </div>
        </div>
      </div>
    </div>

    @if (formOpen()) {
      <app-modal [title]="editingId() ? 'Editar presupuesto' : 'Nuevo presupuesto'" (closed)="resetForm()">
        <form (ngSubmit)="save()">
          <div class="form-grid">
            <label>Categoría
              <app-category-select name="category" [(ngModel)]="form.categoryId" required emptyLabel="Selecciona..."
                [categories]="availableCategories()" type="Expense" (created)="onCategoryCreated($event)" />
            </label>
            <label>Límite mensual
              <app-money name="limit" [(ngModel)]="form.monthlyLimit" required />
            </label>
          </div>
          <p class="muted small-text modal-note">
            Lo gastado suma tus movimientos de gasto y los gastos fijos activos de la categoría.
          </p>
          <div class="modal-actions">
            <button type="button" class="ghost" (click)="resetForm()">Cancelar</button>
            <button type="submit"><app-icon name="check" [size]="18" /> {{ editingId() ? 'Guardar cambios' : 'Agregar' }}</button>
          </div>
        </form>
      </app-modal>
    }

    <div class="cols-2">
      @for (b of items(); track b.id) {
        <div class="card">
          <div class="row spread">
            <strong>{{ b.categoryName }}</strong>
            <span class="badge" [class.warn]="b.state === 'Warning'" [class.bad]="b.state === 'Exceeded'" [class.ok]="b.state === 'Ok'">
              {{ label(b.state) }}
            </span>
          </div>
          <div class="amounts">
            <span class="spent">$ {{ b.spent | cop }}</span>
            <span class="muted">de $ {{ b.monthlyLimit | cop }}</span>
          </div>
          <div class="progress" [class.good]="b.state === 'Ok'" [class.warn]="b.state === 'Warning'" [class.bad]="b.state === 'Exceeded'"
               role="progressbar" [attr.aria-valuenow]="b.percentUsed" aria-valuemin="0" aria-valuemax="100"
               [attr.aria-label]="'Uso del presupuesto de ' + b.categoryName">
            <span [style.width.%]="min100(b.percentUsed)"></span>
          </div>
          <div class="row spread" style="margin-top:12px">
            <span class="small-text" [class.neg]="b.remaining < 0" [class.muted]="b.remaining >= 0">
              {{ b.percentUsed | number: '1.0-0' }}% · {{ b.remaining >= 0 ? 'Restan' : 'Excedido por' }} $ {{ abs(b.remaining) | cop }}
            </span>
            <span class="row">
              <button class="secondary small icon-only" (click)="edit(b)" aria-label="Editar presupuesto"><app-icon name="pencil" [size]="16" /></button>
              <button class="danger small icon-only" (click)="remove(b)" aria-label="Eliminar presupuesto"><app-icon name="trash" [size]="16" /></button>
            </span>
          </div>
        </div>
      } @empty {
        <div class="card" style="grid-column:1/-1">
          <div class="empty-state">
            <span class="chip"><app-icon name="target" [size]="26" /></span>
            Aún no defines presupuestos.
          </div>
        </div>
      }
    </div>

    @if (removing(); as b) {
      <app-confirm-dialog
        title="Eliminar presupuesto"
        [message]="'¿Eliminar el presupuesto de «' + b.categoryName + '»?'"
        detail="Dejarás de controlar el límite mensual de esta categoría. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        (confirmed)="confirmRemove(b)"
        (cancelled)="removing.set(null)" />
    }
  `,
  styles: `
    .amounts { display: flex; align-items: baseline; gap: 8px; margin: 10px 0 12px; }
    .spent { font-size: 1.5rem; font-weight: 750; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
  `,
})
export class BudgetsPage {
  private api = inject(ApiService);

  month = signal(currentMonth());
  items = signal<BudgetStatus[]>([]);
  categories = signal<Category[]>([]);
  editingId = signal<number | null>(null);
  formOpen = signal(false);
  removing = signal<BudgetStatus | null>(null);
  error = signal('');

  totalLimit = computed(() => this.items().reduce((s, b) => s + b.monthlyLimit, 0));
  totalSpent = computed(() => this.items().reduce((s, b) => s + b.spent, 0));
  availableCategories = computed(() => {
    const used = new Set(this.items().filter(b => b.id !== this.editingId()).map(b => b.categoryId));
    return this.categories().filter(c => !used.has(c.id));
  });

  form = this.emptyForm();

  constructor() { this.init(); }

  private emptyForm() { return { categoryId: null as number | null, monthlyLimit: null as number | null }; }

  label(s: BudgetState) { return STATE_LABEL[s]; }
  abs(n: number) { return Math.abs(n); }
  min100(n: number) { return Math.min(100, n); }

  async init() {
    try {
      this.categories.set((await this.api.categories()).filter(c => c.type === 'Expense'));
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); }
  }

  changeMonth(value: string) {
    if (!value) return;
    this.month.set(value);
    this.load();
  }

  async load() {
    try {
      const [y, m] = this.month().split('-').map(Number);
      this.items.set(await this.api.budgetStatus(y, m));
      this.error.set('');
    } catch (e) { this.error.set(errMsg(e)); }
  }

  openNew() { this.resetForm(); this.formOpen.set(true); }

  onCategoryCreated(c: Category) { this.categories.update(list => [...list, c]); }

  edit(b: BudgetStatus) {
    this.editingId.set(b.id);
    this.form = { categoryId: b.categoryId, monthlyLimit: b.monthlyLimit };
    this.formOpen.set(true);
  }

  resetForm() { this.editingId.set(null); this.form = this.emptyForm(); this.formOpen.set(false); }

  async save() {
    const f = this.form;
    if (!f.categoryId || !f.monthlyLimit) { this.error.set('Selecciona una categoría e indica el límite.'); return; }
    const body = { categoryId: f.categoryId, monthlyLimit: f.monthlyLimit };
    try {
      const id = this.editingId();
      if (id) await this.api.updateBudget(id, body); else await this.api.createBudget(body);
      this.resetForm();
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async remove(b: BudgetStatus) { this.removing.set(b); }

  async confirmRemove(b: BudgetStatus) {
    try {
      await this.api.deleteBudget(b.id);
      this.removing.set(null);
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); this.removing.set(null); }
  }
}

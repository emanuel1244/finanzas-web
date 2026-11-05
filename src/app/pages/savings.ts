import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Contribution, SavingsPlan, errMsg, today } from '../core/api';
import { Icon } from '../core/icon';
import { Modal } from '../core/modal';
import { ConfirmDialog } from '../core/confirm-dialog';
import { CopPipe, MoneyInput } from '../core/money';

@Component({
  selector: 'app-savings',
  imports: [FormsModule, DecimalPipe, CopPipe, MoneyInput, Modal, ConfirmDialog, Icon],
  template: `
    <div class="page-head">
      <div>
        <h2>Planes de ahorro</h2>
        <p class="sub">Define metas y registra tus aportes para alcanzarlas.</p>
      </div>
      <div class="actions">
        <button type="button" (click)="formOpen.set(!formOpen())"><app-icon name="plus" [size]="18" /> Nuevo plan</button>
      </div>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }

    <div class="grid">
      <div class="card kpi">
        <span class="chip ok"><app-icon name="wallet" /></span>
        <div><div class="label">Total ahorrado</div><div class="value pos">$ {{ totalSaved() | cop }}</div></div>
      </div>
      <div class="card kpi">
        <span class="chip"><app-icon name="target" /></span>
        <div><div class="label">Meta total</div><div class="value">$ {{ totalTarget() | cop }}</div></div>
      </div>
      <div class="card kpi">
        <span class="chip warn"><app-icon name="calendar" /></span>
        <div><div class="label">Aporte mensual sugerido</div><div class="value">$ {{ totalSuggested() | cop }}</div></div>
      </div>
    </div>

    @if (formOpen()) {
      <app-modal title="Nuevo plan de ahorro" (closed)="formOpen.set(false)">
        <form (ngSubmit)="create()">
          <div class="form-grid">
            <label style="grid-column:1/-1">Nombre <input name="name" maxlength="150" [(ngModel)]="form.name" required /></label>
            <label>Meta <app-money name="target" [(ngModel)]="form.targetAmount" required /></label>
            <label>Inicio <input name="start" type="date" [(ngModel)]="form.startDate" required /></label>
            <label>Fecha objetivo <input name="end" type="date" [(ngModel)]="form.targetDate" required /></label>
          </div>
          <div class="modal-actions">
            <button type="button" class="ghost" (click)="formOpen.set(false)">Cancelar</button>
            <button type="submit"><app-icon name="check" [size]="18" /> Crear plan</button>
          </div>
        </form>
      </app-modal>
    }

    @for (p of plans(); track p.id) {
      <div class="card">
        <div class="item-head">
          <div class="ring ok" [style.--p]="p.progressPercent" role="img" [attr.aria-label]="'Completado ' + p.progressPercent.toFixed(0) + '%'">
            <span>{{ p.progressPercent | number: '1.0-0' }}%</span>
          </div>
          <div class="info">
            <div class="row">
              <h3>{{ p.name }}</h3>
              @if (p.status === 'Completed') { <span class="badge paid"><app-icon name="check" [size]="13" /> ¡Meta lograda!</span> }
            </div>
            <div class="muted small-text">{{ p.startDate }} → {{ p.targetDate }}</div>
          </div>
          <div class="facts">
            <div><div class="label">Ahorrado</div><div class="value pos">$ {{ p.currentAmount | cop }}</div></div>
            <div><div class="label">Meta</div><div class="value">$ {{ p.targetAmount | cop }}</div></div>
            <div><div class="label">Sugerido / mes</div><div class="value">$ {{ p.suggestedMonthlyContribution | cop }}</div></div>
          </div>
        </div>

        <div class="pay">
          <app-money placeholder="Monto a aportar" [ariaLabel]="'Aporte para ' + p.name"
            [ngModel]="amounts[p.id] === undefined ? p.suggestedMonthlyContribution : amounts[p.id]" (ngModelChange)="amounts[p.id] = $event" />
          <input type="date" aria-label="Fecha del aporte" [ngModel]="date" (ngModelChange)="date = $event" />
          <button (click)="contribute(p)"><app-icon name="plus" [size]="18" /> Aportar</button>
        </div>

        <div class="row" style="margin-top:14px">
          <button class="secondary small" (click)="toggle(p)"><app-icon name="list" [size]="15" /> Ver aportes</button>
          <button class="danger small" (click)="remove(p)"><app-icon name="trash" [size]="15" /> Eliminar</button>
        </div>

        @if (selectedId() === p.id) {
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Fecha</th><th class="num">Monto</th><th>Nota</th></tr></thead>
              <tbody>
                @for (c of contributions(); track c.id) {
                  <tr><td class="muted">{{ c.date }}</td><td class="num">{{ c.amount | cop }}</td><td>{{ c.note }}</td></tr>
                } @empty { <tr><td colspan="3" class="empty">Aún no hay aportes.</td></tr> }
              </tbody>
            </table>
          </div>
        }
      </div>
    } @empty {
      <div class="card">
        <div class="empty-state">
          <span class="chip"><app-icon name="wallet" [size]="26" /></span>
          No tienes planes de ahorro.
        </div>
      </div>
    }

    @if (removing(); as p) {
      <app-confirm-dialog
        title="Eliminar plan de ahorro"
        [message]="'¿Eliminar el plan «' + p.name + '»?'"
        detail="Se borrarán también todos los aportes registrados de este plan. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        (confirmed)="confirmRemove(p)"
        (cancelled)="removing.set(null)" />
    }
  `,
  styles: `
    .item-head { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
    .info { flex: 1; min-width: 200px; }
    .facts { display: flex; gap: 28px; flex-wrap: wrap; }
    .facts .label { color: var(--muted); font-size: .76rem; font-weight: 600; }
    .facts .value { font-size: 1.15rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .pay { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; padding: 14px; border-radius: 12px; background: var(--surface-2); border: 1px dashed var(--border); }
    .pay input, .pay app-money { flex: 1; min-width: 150px; }
  `,
})
export class SavingsPage {
  private api = inject(ApiService);

  plans = signal<SavingsPlan[]>([]);
  contributions = signal<Contribution[]>([]);
  selectedId = signal<number | null>(null);
  formOpen = signal(false);
  removing = signal<SavingsPlan | null>(null);
  error = signal('');

  totalSaved = computed(() => this.plans().reduce((s, p) => s + p.currentAmount, 0));
  totalTarget = computed(() => this.plans().reduce((s, p) => s + p.targetAmount, 0));
  totalSuggested = computed(() => this.plans().filter(p => p.status === 'Active').reduce((s, p) => s + p.suggestedMonthlyContribution, 0));

  amounts: Record<number, number | null> = {};
  date = today();
  form = this.emptyForm();

  constructor() { this.load(); }

  private emptyForm() {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    const iso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    return { name: '', targetAmount: null as number | null, startDate: today(), targetDate: iso };
  }

  async load() {
    try { this.plans.set(await this.api.savingsPlans()); } catch (e) { this.error.set(errMsg(e)); }
  }

  async create() {
    const f = this.form;
    if (!f.name.trim() || !f.targetAmount) { this.error.set('Completa nombre y meta.'); return; }
    try {
      await this.api.createSavingsPlan({ name: f.name, targetAmount: f.targetAmount, startDate: f.startDate, targetDate: f.targetDate });
      this.error.set('');
      this.form = this.emptyForm();
      this.formOpen.set(false);
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async contribute(p: SavingsPlan) {
    const amount = this.amounts[p.id] ?? p.suggestedMonthlyContribution;
    try {
      await this.api.contribute(p.id, amount, this.date, null);
      this.error.set('');
      delete this.amounts[p.id];
      await this.load();
      if (this.selectedId() === p.id) this.contributions.set(await this.api.contributions(p.id));
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async toggle(p: SavingsPlan) {
    if (this.selectedId() === p.id) { this.selectedId.set(null); return; }
    try {
      this.contributions.set(await this.api.contributions(p.id));
      this.selectedId.set(p.id);
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async remove(p: SavingsPlan) { this.removing.set(p); }

  async confirmRemove(p: SavingsPlan) {
    try {
      await this.api.deleteSavingsPlan(p.id);
      this.removing.set(null);
      if (this.selectedId() === p.id) this.selectedId.set(null);
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); this.removing.set(null); }
  }
}

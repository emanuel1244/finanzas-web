import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AMORTIZATION_LABELS, AMORTIZATION_SYSTEMS, AmortizationSystem,
  ApiService, Debt, DebtPayment, PERIODS, PERIOD_LABELS, PeriodType, ScheduleRow, errMsg, today,
} from '../core/api';
import { Icon } from '../core/icon';
import { Modal } from '../core/modal';
import { ConfirmDialog } from '../core/confirm-dialog';
import { CopPipe, MoneyInput } from '../core/money';

@Component({
  selector: 'app-debts',
  imports: [FormsModule, DecimalPipe, CopPipe, MoneyInput, Modal, ConfirmDialog, Icon],
  template: `
    <div class="page-head">
      <div>
        <h2>Deudas</h2>
        <p class="sub">Controla saldos, cuotas e intereses de tus préstamos.</p>
      </div>
      <div class="actions">
        <button type="button" (click)="openNew()"><app-icon name="plus" [size]="18" /> Registrar deuda</button>
      </div>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }

    <div class="grid">
      <div class="card kpi">
        <span class="chip bad"><app-icon name="card" /></span>
        <div><div class="label">Saldo total pendiente</div><div class="value">$ {{ totalBalance() | cop }}</div></div>
      </div>
      <div class="card kpi">
        <span class="chip warn"><app-icon name="calendar" /></span>
        <div><div class="label">Compromiso mensual</div><div class="value">$ {{ totalMonthly() | cop }}</div></div>
      </div>
      <div class="card kpi">
        <span class="chip"><app-icon name="list" /></span>
        <div><div class="label">Deudas activas</div><div class="value">{{ activeCount() }}</div></div>
      </div>
    </div>

    @if (formOpen()) {
      <app-modal [title]="editingId() ? 'Editar deuda' : 'Registrar deuda'" (closed)="resetForm()">
        <form (ngSubmit)="save()">
          <div class="form-grid">
            <label>Nombre <input name="name" maxlength="150" [(ngModel)]="form.name" required /></label>
            <label>Acreedor <input name="creditor" maxlength="150" [(ngModel)]="form.creditor" /></label>
            <label>Monto prestado
              <app-money name="principal" [(ngModel)]="form.principal" [disabled]="!!editingId()" required />
            </label>
            <label>Interés por periodo (%)
              <input name="rate" type="number" min="0" step="0.01" [(ngModel)]="form.rate" [disabled]="!!editingId()" required />
            </label>
            <label>Periodicidad
              <select name="period" [(ngModel)]="form.period" [disabled]="!!editingId()">
                @for (p of periods; track p) { <option [value]="p">{{ labels[p] }}</option> }
              </select>
            </label>
            <label>Número de periodos
              <input name="total" type="number" min="1" step="1" [(ngModel)]="form.totalPeriods" [disabled]="!!editingId()" required />
            </label>
            <label>Fecha de inicio
              <input name="start" type="date" [(ngModel)]="form.startDate" [disabled]="!!editingId()" required />
            </label>
            <label style="grid-column:1/-1">Sistema de cálculo de cuotas
              <select name="system" [(ngModel)]="form.amortizationSystem" [disabled]="!!editingId()">
                @for (s of systems; track s) { <option [value]="s">{{ systemLabels[s] }}</option> }
              </select>
            </label>
          </div>
          @if (editingId()) {
            <p class="muted small-text modal-note">
              Solo puedes cambiar el nombre y el acreedor. Los términos financieros (monto, interés, plazo y
              sistema) no se modifican una vez creada la deuda; si necesitas otros términos, crea una deuda nueva.
            </p>
          } @else {
            <p class="muted small-text modal-note">{{ systemHint(form.amortizationSystem) }}</p>
          }
          <div class="modal-actions">
            <button type="button" class="ghost" (click)="resetForm()">Cancelar</button>
            <button type="submit"><app-icon name="check" [size]="18" /> {{ editingId() ? 'Guardar cambios' : 'Agregar deuda' }}</button>
          </div>
        </form>
      </app-modal>
    }

    @for (d of debts(); track d.id) {
      <div class="card">
        <div class="item-head">
          <div class="ring" [class.ok]="d.status === 'Paid'" [style.--p]="progress(d)" role="img" [attr.aria-label]="'Pagado ' + progress(d).toFixed(0) + '%'">
            <span>{{ progress(d) | number: '1.0-0' }}%</span>
          </div>
          <div class="info">
            <div class="row">
              <h3>{{ d.name }}</h3>
              @if (d.status === 'Paid') { <span class="badge paid"><app-icon name="check" [size]="13" /> Pagada</span> }
              <span class="badge">{{ systemShort(d.amortizationSystem) }}</span>
            </div>
            <div class="muted small-text">
              @if (d.creditor) { {{ d.creditor }} · }
              {{ d.interestRatePerPeriod }}% {{ labels[d.period].toLowerCase() }} · {{ d.paymentsMade }}/{{ d.totalPeriods }} pagos
            </div>
          </div>
          <div class="facts">
            <div><div class="label">Saldo pendiente</div><div class="value">$ {{ d.balance | cop }}</div></div>
            <div><div class="label">Cuota actual</div><div class="value">$ {{ d.currentInstallment | cop }}</div></div>
            <div><div class="label">Interés pagado</div><div class="value">$ {{ d.totalInterestPaid | cop }}</div></div>
          </div>
        </div>

        @if (d.status === 'Active') {
          <div class="pay">
            <app-money placeholder="Monto del pago" [ariaLabel]="'Pago para ' + d.name"
              [ngModel]="payAmounts[d.id] === undefined ? d.currentInstallment : payAmounts[d.id]" (ngModelChange)="payAmounts[d.id] = $event" />
            <input type="date" aria-label="Fecha del pago" [ngModel]="payDate" (ngModelChange)="payDate = $event" />
            <button (click)="pay(d)"><app-icon name="check" [size]="18" /> Registrar pago</button>
          </div>
        }

        <div class="row" style="margin-top:14px">
          <button class="secondary small" (click)="toggle(d, 'schedule')"><app-icon name="calendar" [size]="15" /> Amortización</button>
          <button class="secondary small" (click)="toggle(d, 'payments')"><app-icon name="list" [size]="15" /> Pagos realizados</button>
          <button class="secondary small" (click)="edit(d)"><app-icon name="pencil" [size]="15" /> Editar</button>
          <button class="danger small" (click)="askRemove(d)"><app-icon name="trash" [size]="15" /> Eliminar</button>
        </div>

        @if (selectedId() === d.id) {
          <div class="table-wrap" style="margin-top:14px">
            @if (view() === 'schedule') {
              <table>
                <thead><tr><th>#</th><th>Vence</th><th class="num">Cuota</th><th class="num">Interés</th><th class="num">Capital</th><th class="num">Saldo</th></tr></thead>
                <tbody>
                  @for (r of schedule(); track r.number) {
                    <tr><td>{{ r.number }}</td><td class="muted">{{ r.dueDate }}</td>
                      <td class="num">{{ r.installment | cop }}</td><td class="num">{{ r.interest | cop }}</td>
                      <td class="num">{{ r.capital | cop }}</td><td class="num">{{ r.balance | cop }}</td></tr>
                  } @empty { <tr><td colspan="6" class="empty">No hay cuotas pendientes.</td></tr> }
                </tbody>
              </table>
            } @else {
              @if (totalShortfall() > 0) {
                <p class="muted small-text" style="margin:0 0 10px">
                  <app-icon name="alert" [size]="14" />
                  Saldo a favor acumulado por pagos parciales: <strong>$ {{ totalShortfall() | cop }}</strong>
                  (registrado como ingreso del mes).
                </p>
              }
              <table>
                <thead><tr><th>Fecha</th><th class="num">Pago</th><th class="num">Interés</th><th class="num">Capital</th><th class="num">Saldo a favor</th><th class="num">Saldo</th></tr></thead>
                <tbody>
                  @for (p of payments(); track p.id) {
                    <tr><td class="muted">{{ p.date }}</td><td class="num">{{ p.amount | cop }}</td>
                      <td class="num">{{ p.interest | cop }}</td><td class="num">{{ p.capital | cop }}</td>
                      <td class="num">
                        @if (p.isPartial) {
                          <span class="badge warn" [title]="'Cuota esperada: $' + (p.installmentDue | cop)">+$ {{ p.shortfall | cop }}</span>
                        } @else { <span class="muted">—</span> }
                      </td>
                      <td class="num">{{ p.balanceAfter | cop }}</td></tr>
                  } @empty { <tr><td colspan="6" class="empty">Aún no hay pagos.</td></tr> }
                </tbody>
              </table>
            }
          </div>
        }
      </div>
    } @empty {
      <div class="card">
        <div class="empty-state">
          <span class="chip"><app-icon name="card" [size]="26" /></span>
          No tienes deudas registradas.
        </div>
      </div>
    }

    @if (removing(); as d) {
      <app-confirm-dialog
        title="Eliminar deuda"
        [message]="'¿Eliminar la deuda «' + d.name + '»?'"
        detail="Se borrarán también todos los pagos registrados de esta deuda. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        (confirmed)="confirmRemove(d)"
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
export class DebtsPage {
  private api = inject(ApiService);
  readonly periods = PERIODS;
  readonly labels = PERIOD_LABELS;
  readonly systems = AMORTIZATION_SYSTEMS;
  readonly systemLabels = AMORTIZATION_LABELS;

  debts = signal<Debt[]>([]);
  selectedId = signal<number | null>(null);
  view = signal<'schedule' | 'payments'>('schedule');
  schedule = signal<ScheduleRow[]>([]);
  payments = signal<DebtPayment[]>([]);
  formOpen = signal(false);
  editingId = signal<number | null>(null);
  removing = signal<Debt | null>(null);
  error = signal('');

  totalBalance = computed(() => this.debts().filter(d => d.status === 'Active').reduce((s, d) => s + d.balance, 0));
  totalMonthly = computed(() => this.debts().filter(d => d.status === 'Active').reduce((s, d) => s + d.monthlyCommitment, 0));
  activeCount = computed(() => this.debts().filter(d => d.status === 'Active').length);
  /** Suma de los faltantes (saldo a favor) de los pagos cargados de la deuda seleccionada. */
  totalShortfall = computed(() => this.payments().reduce((s, p) => s + (p.shortfall ?? 0), 0));

  payAmounts: Record<number, number | null> = {};
  payDate = today();
  form = this.emptyForm();

  constructor() { this.load(); }

  private emptyForm() {
    return {
      name: '', creditor: '', principal: null as number | null, rate: 0,
      period: 'Monthly' as PeriodType, totalPeriods: 12, startDate: today(),
      amortizationSystem: 'French' as AmortizationSystem,
    };
  }

  progress(d: Debt) { return Math.max(0, Math.min(100, ((d.principal - d.balance) / d.principal) * 100)); }

  systemShort(s: AmortizationSystem) {
    return s === 'French' ? 'Francés' : s === 'German' ? 'Alemán' : 'Interés simple';
  }

  systemHint(s: AmortizationSystem) {
    switch (s) {
      case 'German': return 'Alemán: amortizas el mismo capital cada periodo; la cuota total va bajando con el saldo.';
      case 'SimpleInterest': return 'Interés simple: el interés se calcula siempre sobre el capital original; la cuota es fija.';
      default: return 'Francés: cuota total fija durante todo el préstamo (el típico de los bancos).';
    }
  }

  async load() {
    try { this.debts.set(await this.api.debts()); } catch (e) { this.error.set(errMsg(e)); }
  }

  openNew() { this.editingId.set(null); this.form = this.emptyForm(); this.error.set(''); this.formOpen.set(true); }

  edit(d: Debt) {
    this.editingId.set(d.id);
    this.form = {
      name: d.name, creditor: d.creditor ?? '', principal: d.principal, rate: d.interestRatePerPeriod,
      period: d.period, totalPeriods: d.totalPeriods, startDate: d.startDate, amortizationSystem: d.amortizationSystem,
    };
    this.error.set('');
    this.formOpen.set(true);
  }

  resetForm() { this.editingId.set(null); this.form = this.emptyForm(); this.formOpen.set(false); }

  async save() {
    const f = this.form;
    if (!f.name.trim()) { this.error.set('El nombre es obligatorio.'); return; }
    const id = this.editingId();
    try {
      if (id) {
        await this.api.updateDebt(id, { name: f.name, creditor: f.creditor || null });
      } else {
        if (!f.principal) { this.error.set('Completa nombre y monto.'); return; }
        await this.api.createDebt({
          name: f.name, creditor: f.creditor || null, principal: f.principal, interestRatePerPeriod: f.rate,
          period: f.period, totalPeriods: f.totalPeriods, startDate: f.startDate, amortizationSystem: f.amortizationSystem,
        });
      }
      this.error.set('');
      this.resetForm();
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async pay(d: Debt) {
    const amount = this.payAmounts[d.id] ?? d.currentInstallment;
    try {
      await this.api.payDebt(d.id, amount, this.payDate);
      this.error.set('');
      delete this.payAmounts[d.id];
      await this.load();
      if (this.selectedId() === d.id) await this.loadDetail(d.id);
    } catch (e) { this.error.set(errMsg(e)); }
  }

  async toggle(d: Debt, view: 'schedule' | 'payments') {
    if (this.selectedId() === d.id && this.view() === view) { this.selectedId.set(null); return; }
    this.view.set(view);
    this.selectedId.set(d.id);
    await this.loadDetail(d.id);
  }

  private async loadDetail(id: number) {
    try {
      if (this.view() === 'schedule') this.schedule.set(await this.api.debtSchedule(id));
      else this.payments.set(await this.api.debtPayments(id));
    } catch (e) { this.error.set(errMsg(e)); }
  }

  askRemove(d: Debt) { this.removing.set(d); }

  async confirmRemove(d: Debt) {
    try {
      await this.api.deleteDebt(d.id);
      this.removing.set(null);
      if (this.selectedId() === d.id) this.selectedId.set(null);
      await this.load();
    } catch (e) { this.error.set(errMsg(e)); this.removing.set(null); }
  }
}

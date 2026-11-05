import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, CategoryBreakdown, MonthlyTrend, currentMonth, errMsg, monthRange } from '../core/api';
import { Icon } from '../core/icon';
import { CopPipe } from '../core/money';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6'];

@Component({
  selector: 'app-reports',
  imports: [FormsModule, DecimalPipe, CopPipe, Icon],
  template: `
    <div class="page-head">
      <div>
        <h2>Reportes</h2>
        <p class="sub">Evolución de tus ingresos y en qué gastas más.</p>
      </div>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }

    <div class="card">
      <div class="card-head">
        <h3>Ingresos vs gastos</h3>
        <div class="row" style="gap:16px">
          <span class="key"><span class="sw income"></span> Ingresos</span>
          <span class="key"><span class="sw expense"></span> Gastos</span>
          <label style="flex-direction:row;align-items:center;gap:8px">Periodo
            <select [ngModel]="months()" (ngModelChange)="changeMonths($event)">
              <option [ngValue]="3">3 meses</option>
              <option [ngValue]="6">6 meses</option>
              <option [ngValue]="12">12 meses</option>
            </select>
          </label>
        </div>
      </div>

      <div class="chart" role="img" aria-label="Gráfica de ingresos y gastos por mes">
        @for (t of trend(); track $index) {
          <div class="col">
            <div class="bars">
              <div class="bar income" [style.height.%]="(t.income / maxTrend()) * 100" [title]="'Ingresos $ ' + t.income"></div>
              <div class="bar expense" [style.height.%]="(t.totalExpenses / maxTrend()) * 100" [title]="'Gastos $ ' + t.totalExpenses"></div>
            </div>
            <div class="lbl">{{ monthName(t) }}</div>
          </div>
        }
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Gastos fijos</th><th class="num">Gastos variables</th><th class="num">Balance</th></tr></thead>
          <tbody>
            @for (t of trend(); track $index) {
              <tr>
                <td><strong>{{ monthName(t) }} {{ t.year }}</strong></td>
                <td class="num">$ {{ t.income | cop }}</td>
                <td class="num">$ {{ t.fixedExpenses | cop }}</td>
                <td class="num">$ {{ t.variableExpenses | cop }}</td>
                <td class="num" [class.pos]="t.net >= 0" [class.neg]="t.net < 0"><strong>$ {{ t.net | cop }}</strong></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="muted small-text" style="margin-top:10px">Los gastos fijos usan el total de los gastos fijos activos actuales.</p>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Gasto por categoría</h3>
        <label>Mes
          <input type="month" [ngModel]="month()" (ngModelChange)="changeMonth($event)" />
        </label>
      </div>
      @for (c of breakdown(); track c.category; let i = $index) {
        <div class="item">
          <div class="row spread">
            <span class="row"><span class="dot" [style.background]="color(i)"></span> {{ c.category }}</span>
            <span><strong>$ {{ c.total | cop }}</strong> <span class="muted small-text">· {{ c.percent | number: '1.0-1' }}%</span></span>
          </div>
          <div class="progress"><span [style.width.%]="c.percent" [style.background]="color(i)"></span></div>
        </div>
      } @empty {
        <div class="empty-state">
          <span class="chip"><app-icon name="inbox" [size]="26" /></span>
          Sin gastos en este mes.
        </div>
      }
    </div>
  `,
  styles: `
    .key { display: inline-flex; align-items: center; gap: 6px; font-size: .85rem; color: var(--muted); font-weight: 500; }
    .sw { width: 12px; height: 12px; border-radius: 4px; }
    .sw.income, .bar.income { background: linear-gradient(180deg, #34d399, #059669); }
    .sw.expense, .bar.expense { background: linear-gradient(180deg, #fb7185, #e11d48); }

    .chart {
      display: flex; gap: 14px; align-items: stretch; height: 220px; margin: 4px 0 22px;
      padding: 0 4px; border-bottom: 1px solid var(--border);
      background: repeating-linear-gradient(to top, transparent 0, transparent 54px, var(--border) 54px, var(--border) 55px);
    }
    .col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .bars { display: flex; gap: 5px; align-items: flex-end; justify-content: center; flex: 1; }
    .bar { width: 38%; max-width: 34px; min-height: 3px; border-radius: 6px 6px 0 0; transition: height .5s cubic-bezier(.2, .8, .2, 1); }
    .lbl { text-align: center; font-size: .78rem; color: var(--muted); padding: 8px 0 6px; font-weight: 600; }

    .item { margin-bottom: 16px; }
    .item .progress { margin-top: 8px; height: 8px; }
    .dot { width: 12px; height: 12px; border-radius: 4px; display: inline-block; }
  `,
})
export class ReportsPage {
  private api = inject(ApiService);

  months = signal(6);
  month = signal(currentMonth());
  trend = signal<MonthlyTrend[]>([]);
  breakdown = signal<CategoryBreakdown[]>([]);
  error = signal('');
  maxTrend = computed(() => Math.max(1, ...this.trend().flatMap(t => [t.income, t.totalExpenses])));

  constructor() { this.loadTrend(); this.loadBreakdown(); }

  monthName(t: MonthlyTrend) { return MONTH_NAMES[t.month - 1]; }
  color(i: number) { return PALETTE[i % PALETTE.length]; }

  changeMonths(n: number) { this.months.set(n); this.loadTrend(); }

  changeMonth(value: string) {
    if (!value) return;
    this.month.set(value);
    this.loadBreakdown();
  }

  async loadTrend() {
    try { this.trend.set(await this.api.monthlyTrend(this.months())); this.error.set(''); }
    catch (e) { this.error.set(errMsg(e)); }
  }

  async loadBreakdown() {
    try {
      const { from, to } = monthRange(this.month());
      this.breakdown.set(await this.api.expensesByCategory(from, to));
      this.error.set('');
    } catch (e) { this.error.set(errMsg(e)); }
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Dashboard, currentMonth, errMsg } from '../core/api';
import { Icon } from '../core/icon';
import { CopPipe } from '../core/money';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6'];

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, DecimalPipe, CopPipe, Icon],
  template: `
    <div class="page-head">
      <div>
        <h2>Resumen</h2>
        <p class="sub">Cómo va tu dinero en el mes seleccionado.</p>
      </div>
      <div class="actions">
        <label>Mes
          <input type="month" [ngModel]="month()" (ngModelChange)="changeMonth($event)" />
        </label>
      </div>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alert" [size]="18" /> {{ error() }}</div> }

    @if (data(); as d) {
      <section class="hero card" [class.deficit]="d.available < 0">
        <div>
          <div class="hero-label">Disponible este mes</div>
          <div class="hero-value">$ {{ d.available | cop }}</div>
          <div class="hero-note">
            @if (d.available >= 0) { Después de gastos fijos, variables, deudas y ahorro. }
            @else { Tus salidas superan tus ingresos este mes. }
          </div>
        </div>
        <div class="hero-meter">
          <div class="row spread small-text">
            <span>Salidas vs ingresos</span>
            <strong>{{ outflowPct() | number: '1.0-0' }}%</strong>
          </div>
          <div class="hero-track" role="progressbar" aria-label="Porcentaje de ingresos usado"
               [attr.aria-valuenow]="outflowPct()" aria-valuemin="0" aria-valuemax="100">
            <span [style.width.%]="outflowPct()"></span>
          </div>
          <div class="row spread small-text">
            <span>Ingresos $ {{ d.income | cop }}</span>
            <span>Salidas $ {{ d.totalOutflow | cop }}</span>
          </div>
        </div>
      </section>

      <div class="grid">
        <div class="card kpi">
          <span class="chip ok"><app-icon name="up" /></span>
          <div><div class="label">Ingresos</div><div class="value pos">$ {{ d.income | cop }}</div></div>
        </div>
        <div class="card kpi">
          <span class="chip info"><app-icon name="receipt" /></span>
          <div><div class="label">Gastos fijos</div><div class="value">$ {{ d.fixedExpenses | cop }}</div></div>
        </div>
        <div class="card kpi">
          <span class="chip bad"><app-icon name="down" /></span>
          <div><div class="label">Gastos variables</div><div class="value">$ {{ d.variableExpenses | cop }}</div></div>
        </div>
        <div class="card kpi">
          <span class="chip warn"><app-icon name="card" /></span>
          <div><div class="label">Deudas</div><div class="value">$ {{ d.debtPayments | cop }}</div></div>
        </div>
        <div class="card kpi">
          <span class="chip"><app-icon name="wallet" /></span>
          <div><div class="label">Ahorro</div><div class="value">$ {{ d.savingsContributions | cop }}</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Gastos variables por categoría</h3></div>
        @if (d.expensesByCategory.length) {
          <div class="donut-wrap">
            <div class="donut" [style.background]="donut()" role="img" aria-label="Distribución de gastos por categoría">
              <div class="donut-hole">
                <span class="muted small-text">Total</span>
                <strong>$ {{ d.variableExpenses | cop }}</strong>
              </div>
            </div>
            <ul class="legend">
              @for (c of d.expensesByCategory; track c.category; let i = $index) {
                <li>
                  <span class="dot" [style.background]="color(i)"></span>
                  <span class="name">{{ c.category }}</span>
                  <span class="muted small-text">{{ pct(c.total) | number: '1.0-0' }}%</span>
                  <strong>$ {{ c.total | cop }}</strong>
                </li>
              }
            </ul>
          </div>
        } @else {
          <div class="empty-state">
            <span class="chip"><app-icon name="inbox" [size]="26" /></span>
            Sin gastos variables en este mes.
          </div>
        }
      </div>
    }
  `,
  styles: `
    .hero {
      display: grid; gap: 28px; grid-template-columns: 1.1fr 1fr; align-items: center;
      color: #fff; border: 0; padding: 28px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #a855f7 100%);
      box-shadow: 0 14px 34px rgba(99, 102, 241, .35);
    }
    .hero.deficit { background: linear-gradient(135deg, #be123c 0%, #e11d48 55%, #fb7185 100%); box-shadow: 0 14px 34px rgba(225, 29, 72, .3); }
    .hero-label { font-size: .85rem; font-weight: 600; opacity: .85; text-transform: uppercase; letter-spacing: .08em; }
    .hero-value { font-size: 2.8rem; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; line-height: 1.15; margin: 6px 0; }
    .hero-note { opacity: .85; font-size: .92rem; }
    .hero-meter { display: flex; flex-direction: column; gap: 8px; background: rgba(255, 255, 255, .13); padding: 16px 18px; border-radius: 14px; }
    .hero-track { height: 10px; border-radius: 999px; background: rgba(255, 255, 255, .25); overflow: hidden; }
    .hero-track span { display: block; height: 100%; border-radius: 999px; background: #fff; transition: width .6s ease; }

    .donut-wrap { display: flex; align-items: center; gap: 36px; flex-wrap: wrap; }
    .donut { position: relative; flex: none; width: 190px; height: 190px; border-radius: 50%; display: grid; place-items: center; }
    .donut-hole {
      width: 118px; height: 118px; border-radius: 50%; background: var(--surface);
      display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2;
    }
    .donut-hole strong { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
    .legend { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: 4px; }
    .legend li { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-bottom: 1px solid var(--border); }
    .legend li:last-child { border-bottom: 0; }
    .legend .name { flex: 1; }
    .legend strong { font-variant-numeric: tabular-nums; min-width: 96px; text-align: right; }
    .dot { width: 12px; height: 12px; border-radius: 4px; flex: none; }

    @media (max-width: 760px) {
      .hero { grid-template-columns: 1fr; padding: 20px; }
      .hero-value { font-size: 2.2rem; }
      .donut-wrap { justify-content: center; }
    }
  `,
})
export class DashboardPage {
  private api = inject(ApiService);
  month = signal(currentMonth());
  data = signal<Dashboard | null>(null);
  error = signal('');

  outflowPct = computed(() => {
    const d = this.data();
    if (!d) return 0;
    if (d.income <= 0) return d.totalOutflow > 0 ? 100 : 0;
    return Math.min(100, (d.totalOutflow / d.income) * 100);
  });

  private totalCategories = computed(() => this.data()?.expensesByCategory.reduce((s, c) => s + c.total, 0) ?? 0);

  donut = computed(() => {
    const cats = this.data()?.expensesByCategory ?? [];
    const total = this.totalCategories();
    if (!total) return 'var(--track)';
    let acc = 0;
    const stops = cats.map((c, i) => {
      const start = acc;
      acc += (c.total / total) * 100;
      return `${this.color(i)} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  constructor() { this.load(); }

  color(i: number) { return PALETTE[i % PALETTE.length]; }
  pct(v: number) { const t = this.totalCategories(); return t ? (v / t) * 100 : 0; }

  changeMonth(value: string) {
    if (!value) return;
    this.month.set(value);
    this.load();
  }

  async load() {
    try {
      const [y, m] = this.month().split('-').map(Number);
      this.data.set(await this.api.dashboard(y, m));
      this.error.set('');
    } catch (e) {
      this.error.set(errMsg(e));
    }
  }
}

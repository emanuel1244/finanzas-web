import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// Ruta relativa: en producción CloudFront enruta /api al backend; en desarrollo lo hace proxy.conf.json.
export const API_URL = '/api';

// ---------- Modelos (reflejan los DTOs de la API) ----------
export type TxType = 'Income' | 'Expense';
export type PeriodType = 'Weekly' | 'Biweekly' | 'Monthly' | 'Quarterly' | 'Yearly';
export type AmortizationSystem = 'French' | 'German' | 'SimpleInterest';

export const PERIOD_LABELS: Record<PeriodType, string> = {
  Weekly: 'Semanal',
  Biweekly: 'Quincenal',
  Monthly: 'Mensual',
  Quarterly: 'Trimestral',
  Yearly: 'Anual',
};
export const PERIODS = Object.keys(PERIOD_LABELS) as PeriodType[];

export const AMORTIZATION_LABELS: Record<AmortizationSystem, string> = {
  French: 'Francés (cuota fija · bancos)',
  German: 'Alemán (cuota decreciente · ordinario)',
  SimpleInterest: 'Interés simple',
};
export const AMORTIZATION_SYSTEMS = Object.keys(AMORTIZATION_LABELS) as AmortizationSystem[];

export interface Category { id: number; name: string; type: TxType; }

export interface Transaction {
  id: number; categoryId: number; categoryName: string; type: TxType;
  amount: number; date: string; description: string | null;
}
export interface TransactionRequest { categoryId: number; amount: number; date: string; description: string | null; }

export interface FixedExpense {
  id: number; name: string; amount: number; dayOfMonth: number;
  categoryId: number | null; categoryName: string | null; isActive: boolean;
}
export interface FixedExpenseRequest {
  name: string; amount: number; dayOfMonth: number; categoryId: number | null; isActive: boolean;
}

export interface Debt {
  id: number; name: string; creditor: string | null; principal: number; interestRatePerPeriod: number;
  period: PeriodType; totalPeriods: number; startDate: string; balance: number; status: 'Active' | 'Paid';
  amortizationSystem: AmortizationSystem;
  currentInstallment: number; monthlyCommitment: number; paymentsMade: number; remainingPeriods: number;
  totalInterestPaid: number;
}
export interface DebtRequest {
  name: string; creditor: string | null; principal: number; interestRatePerPeriod: number;
  period: PeriodType; totalPeriods: number; startDate: string; amortizationSystem: AmortizationSystem;
}
/** La API solo permite editar datos descriptivos; los términos financieros son inmutables tras crear. */
export interface DebtUpdateRequest { name: string; creditor: string | null; }
export interface DebtPayment {
  id: number; date: string; amount: number; interest: number; capital: number; balanceAfter: number;
  /** Cuota esperada del periodo al momento del pago. */
  installmentDue: number;
  /** Faltante respecto a la cuota esperada (saldo a favor del mes). 0 si se pagó completa o de más. */
  shortfall: number;
  /** Indica si el abono fue menor que la cuota esperada. */
  isPartial: boolean;
}
export interface ScheduleRow { number: number; dueDate: string; installment: number; interest: number; capital: number; balance: number; }

export interface SavingsPlan {
  id: number; name: string; targetAmount: number; currentAmount: number; progressPercent: number;
  startDate: string; targetDate: string; status: 'Active' | 'Completed'; suggestedMonthlyContribution: number;
}
export interface SavingsPlanRequest { name: string; targetAmount: number; startDate: string; targetDate: string; }
export interface Contribution { id: number; date: string; amount: number; note: string | null; }

export interface Dashboard {
  year: number; month: number; income: number; fixedExpenses: number; variableExpenses: number;
  debtPayments: number; savingsContributions: number; totalOutflow: number; available: number;
  expensesByCategory: { category: string; total: number }[];
}

// ---------- Usuarios ----------
export type Role = 'Admin' | 'Client';
export const ROLE_LABELS: Record<Role, string> = { Admin: 'Administrador', Client: 'Cliente' };
export interface UserAccount { id: number; name: string; email: string; role: Role; isActive: boolean; createdAt: string; }
export interface UserCreateRequest { name: string; email: string; password: string; role: Role; }
export interface UserUpdateRequest { name: string; role: Role; isActive: boolean; }

// ---------- Presupuestos y reportes ----------
export type BudgetState = 'Ok' | 'Warning' | 'Exceeded';
export interface Budget { id: number; categoryId: number; categoryName: string; monthlyLimit: number; }
export interface BudgetRequest { categoryId: number; monthlyLimit: number; }
export interface BudgetStatus {
  id: number; categoryId: number; categoryName: string; monthlyLimit: number;
  spent: number; remaining: number; percentUsed: number; state: BudgetState;
}
export interface MonthlyTrend {
  year: number; month: number; income: number; fixedExpenses: number;
  variableExpenses: number; totalExpenses: number; net: number;
}
export interface CategoryBreakdown { category: string; total: number; percent: number; }

// ---------- Utilidades ----------
const pad = (n: number) => String(n).padStart(2, '0');

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth(): string {
  return today().slice(0, 7);
}

/** Primer y último día de un mes con formato yyyy-MM. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

/** Extrae un mensaje legible de un error HTTP (ProblemDetails de la API). */
export function errMsg(e: any): string {
  if (e?.status === 0) return 'No se pudo conectar con la API. ¿Está ejecutándose?';
  if (e?.status === 429) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
  if (e?.status === 403 && !e?.error?.detail) return 'No tienes permiso para realizar esta acción.';
  const b = e?.error;
  if (b?.errors) return (Object.values(b.errors) as string[][]).flat().join(' ');
  return b?.detail ?? b?.title ?? 'Ocurrió un error inesperado.';
}

// ---------- Servicio HTTP ----------
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  private get<T>(path: string, params?: Record<string, string | number | undefined>) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== '') p = p.set(k, String(v));
    return firstValueFrom(this.http.get<T>(`${API_URL}/${path}`, { params: p }));
  }
  private post<T>(path: string, body: unknown) { return firstValueFrom(this.http.post<T>(`${API_URL}/${path}`, body)); }
  private put<T>(path: string, body: unknown) { return firstValueFrom(this.http.put<T>(`${API_URL}/${path}`, body)); }
  private del(path: string) { return firstValueFrom(this.http.delete<void>(`${API_URL}/${path}`)); }

  dashboard(year: number, month: number) { return this.get<Dashboard>('dashboard', { year, month }); }

  categories() { return this.get<Category[]>('categories'); }

  users() { return this.get<UserAccount[]>('users'); }
  createUser(r: UserCreateRequest) { return this.post<UserAccount>('users', r); }
  updateUser(id: number, r: UserUpdateRequest) { return this.put<UserAccount>(`users/${id}`, r); }
  resetUserPassword(id: number, newPassword: string) { return this.post<void>(`users/${id}/reset-password`, { newPassword }); }
  createCategory(r: { name: string; type: TxType }) { return this.post<Category>('categories', r); }

  budgetStatus(year: number, month: number) { return this.get<BudgetStatus[]>('budgets/status', { year, month }); }
  budgets() { return this.get<Budget[]>('budgets'); }
  createBudget(r: BudgetRequest) { return this.post<Budget>('budgets', r); }
  updateBudget(id: number, r: BudgetRequest) { return this.put<Budget>(`budgets/${id}`, r); }
  deleteBudget(id: number) { return this.del(`budgets/${id}`); }

  monthlyTrend(months: number) { return this.get<MonthlyTrend[]>('reports/monthly-trend', { months }); }
  expensesByCategory(from: string, to: string) {
    return this.get<CategoryBreakdown[]>('reports/expenses-by-category', { from, to });
  }

  transactions(from: string, to: string) { return this.get<Transaction[]>('transactions', { from, to }); }
  createTransaction(r: TransactionRequest) { return this.post<Transaction>('transactions', r); }
  updateTransaction(id: number, r: TransactionRequest) { return this.put<Transaction>(`transactions/${id}`, r); }
  deleteTransaction(id: number) { return this.del(`transactions/${id}`); }

  fixedExpenses() { return this.get<FixedExpense[]>('fixed-expenses'); }
  createFixedExpense(r: FixedExpenseRequest) { return this.post<FixedExpense>('fixed-expenses', r); }
  updateFixedExpense(id: number, r: FixedExpenseRequest) { return this.put<FixedExpense>(`fixed-expenses/${id}`, r); }
  deleteFixedExpense(id: number) { return this.del(`fixed-expenses/${id}`); }

  debts() { return this.get<Debt[]>('debts'); }
  createDebt(r: DebtRequest) { return this.post<Debt>('debts', r); }
  updateDebt(id: number, r: DebtUpdateRequest) { return this.put<Debt>(`debts/${id}`, r); }
  deleteDebt(id: number) { return this.del(`debts/${id}`); }
  debtSchedule(id: number) { return this.get<ScheduleRow[]>(`debts/${id}/schedule`); }
  debtPayments(id: number) { return this.get<DebtPayment[]>(`debts/${id}/payments`); }
  payDebt(id: number, amount: number, date: string) { return this.post<DebtPayment>(`debts/${id}/payments`, { amount, date }); }

  savingsPlans() { return this.get<SavingsPlan[]>('savings-plans'); }
  createSavingsPlan(r: SavingsPlanRequest) { return this.post<SavingsPlan>('savings-plans', r); }
  deleteSavingsPlan(id: number) { return this.del(`savings-plans/${id}`); }
  contributions(id: number) { return this.get<Contribution[]>(`savings-plans/${id}/contributions`); }
  contribute(id: number, amount: number, date: string, note: string | null) {
    return this.post<Contribution>(`savings-plans/${id}/contributions`, { amount, date, note });
  }
}

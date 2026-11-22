import { cache } from 'react';
import { requireOwner } from '@/lib/auth/owner';
import { monthBounds } from '@/lib/finance';

export function todayInVietnam(timeZone = 'Asia/Ho_Chi_Minh') {
  let validZone = 'Asia/Ho_Chi_Minh';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    validZone = timeZone;
  } catch {
    validZone = 'Asia/Ho_Chi_Minh';
  }
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: validZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function periodBounds(period: string | undefined, today = todayInVietnam(), custom?: {from?:string;to?:string}) {
  const [year, month] = today.slice(0,7).split('-').map(Number);
  const validDate = (value: string | undefined) => { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const parsed = new Date(`${value}T00:00:00Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === value; };
  if (period === 'custom' && validDate(custom?.from) && validDate(custom?.to) && custom!.from! <= custom!.to!) {
    return { start: custom!.from!, end: new Date(Date.parse(`${custom!.to}T00:00:00Z`) + 86400000).toISOString().slice(0,10) };
  }
  if (period === 'last') return monthBounds(new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7));
  if (period === 'year') return { start: `${year}-01-01`, end: `${year+1}-01-01` };
  if (period === 'quarter') {
    const q = Math.floor((month - 1) / 3) * 3 + 1;
    return { start: `${year}-${String(q).padStart(2,'0')}-01`, end: new Date(Date.UTC(year,q+2,1)).toISOString().slice(0,10) };
  }
  return monthBounds(today.slice(0,7));
}
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${label}: no data`);
  return result.data;
}

async function workspaceContext() {
  const { readTimezone } = await import('@/lib/auth/timezone');
  const [{ supabase }, timezone] = await Promise.all([requireOwner(), readTimezone()]);
  return { supabase, today: todayInVietnam(timezone) };
}

async function loadReportRows(
  supabase: Awaited<ReturnType<typeof requireOwner>>['supabase'],
  start: string,
  end: string,
  month: string
) {
  const [categories, budgets, projects, periodSpending, actuals, totals, monthly, expenseCategories] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('budgets').select('*').eq('month_start', month).order('month_start', { ascending: false }),
    supabase.from('projects').select('*').order('updated_at', { ascending: false }),
    supabase.rpc('project_spending_period', { p_start: start, p_end: end }),
    supabase.rpc('budget_actuals', { p_month: month }),
    supabase.rpc('period_totals', { p_start: start, p_end: end }),
    supabase.rpc('monthly_report', { p_start: start, p_end: end }),
    supabase.rpc('expense_categories', { p_start: start, p_end: end }),
  ]);
  return {
    start,
    end,
    month,
    categories: unwrap(categories, 'categories'),
    budgets: unwrap(budgets, 'budgets'),
    projects: unwrap(projects, 'projects'),
    periodSpending: unwrap(periodSpending, 'period project spending'),
    actuals: unwrap(actuals, 'budget actuals'),
    totals: unwrap(totals, 'period totals')[0] ?? { income: '0', expense: '0' },
    monthly: unwrap(monthly, 'monthly report'),
    expenseCategories: unwrap(expenseCategories, 'expense categories'),
  };
}

export async function loadReportWorkspace(period?: string, custom?: { from?: string; to?: string }) {
  const { supabase, today } = await workspaceContext();
  const { start, end } = periodBounds(period, today, custom);
  const month = `${today.slice(0, 7)}-01`;
  return { today, ...(await loadReportRows(supabase, start, end, month)) };
}

export async function loadFinanceOverviewWorkspace(period?: string, custom?: { from?: string; to?: string }) {
  const { supabase, today } = await workspaceContext();
  const { start, end } = periodBounds(period, today, custom);
  const month = `${today.slice(0, 7)}-01`;
  const [report, balances, budgetTotals, transactions] = await Promise.all([
    loadReportRows(supabase, start, end, month),
    supabase.rpc('account_balances'),
    supabase.rpc('budget_month_totals', { p_month: month }),
    supabase.from('transactions').select('*').gte('transaction_date', start).lt('transaction_date', end).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(8),
  ]);
  return {
    today,
    ...report,
    balances: unwrap(balances, 'account balances'),
    budgetTotals: unwrap(budgetTotals, 'budget month totals')[0] ?? { budget: '0', spent: '0' },
    transactions: unwrap(transactions, 'transactions'),
  };
}

export async function loadProjectDetailWorkspace() {
  const { supabase, today } = await workspaceContext();
  const [accounts, categories, transactions, projects, tasks, milestones, spending] = await Promise.all([
    supabase.from('accounts').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('projects').select('*').order('updated_at', { ascending: false }),
    supabase.from('tasks').select('*').order('position').order('created_at'),
    supabase.from('milestones').select('*').order('position'),
    supabase.rpc('project_spending'),
  ]);
  return {
    today,
    accounts: unwrap(accounts, 'accounts'),
    categories: unwrap(categories, 'categories'),
    transactions: unwrap(transactions, 'transactions'),
    projects: unwrap(projects, 'projects'),
    tasks: unwrap(tasks, 'tasks'),
    milestones: unwrap(milestones, 'milestones'),
    spending: unwrap(spending, 'project spending'),
  };
}

export const loadDatabaseWorkspace = cache(async function loadDatabaseWorkspace() {
  const { supabase, today } = await workspaceContext();
  const month = `${today.slice(0, 7)}-01`;
  const [accounts, categories, transactions, budgets, projects, tasks, milestones, balances, spending, actuals] = await Promise.all([
    supabase.from('accounts').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('budgets').select('*').order('month_start', { ascending: false }),
    supabase.from('projects').select('*').order('updated_at', { ascending: false }),
    supabase.from('tasks').select('*').order('position').order('created_at'),
    supabase.from('milestones').select('*').order('position'),
    supabase.rpc('account_balances'),
    supabase.rpc('project_spending'),
    supabase.rpc('budget_actuals', { p_month: month }),
  ]);
  return {
    month,
    accounts: unwrap(accounts, 'accounts'),
    categories: unwrap(categories, 'categories'),
    transactions: unwrap(transactions, 'transactions'),
    budgets: unwrap(budgets, 'budgets'),
    projects: unwrap(projects, 'projects'),
    tasks: unwrap(tasks, 'tasks'),
    milestones: unwrap(milestones, 'milestones'),
    balances: unwrap(balances, 'account balances'),
    spending: unwrap(spending, 'project spending'),
    actuals: unwrap(actuals, 'budget actuals'),
  };
});

export async function loadAccountsWorkspace() {
  const { supabase, today } = await workspaceContext();
  const [accounts, balances] = await Promise.all([
    supabase.from('accounts').select('*').order('name'),
    supabase.rpc('account_balances'),
  ]);
  return { today, accounts: unwrap(accounts, 'accounts'), balances: unwrap(balances, 'account balances') };
}

export async function loadCategoriesWorkspace() {
  const { supabase } = await workspaceContext();
  const categories = await supabase.from('categories').select('*').order('name');
  return { categories: unwrap(categories, 'categories') };
}

export async function loadTransactionsWorkspace() {
  const { supabase, today } = await workspaceContext();
  const [accounts, categories, projects, transactions] = await Promise.all([
    supabase.from('accounts').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase.from('projects').select('*').order('updated_at', { ascending: false }),
    supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
  ]);
  return {
    today,
    accounts: unwrap(accounts, 'accounts'),
    categories: unwrap(categories, 'categories'),
    projects: unwrap(projects, 'projects'),
    transactions: unwrap(transactions, 'transactions'),
  };
}

export async function loadProjectsWorkspace() {
  const { supabase } = await workspaceContext();
  const [projects, tasks, spending] = await Promise.all([
    supabase.from('projects').select('*').order('updated_at', { ascending: false }),
    supabase.from('tasks').select('*').order('position').order('created_at'),
    supabase.rpc('project_spending'),
  ]);
  return { projects: unwrap(projects, 'projects'), tasks: unwrap(tasks, 'tasks'), spending: unwrap(spending, 'project spending') };
}

export async function loadTasksWorkspace() {
  const { supabase, today } = await workspaceContext();
  const [projects, tasks] = await Promise.all([
    supabase.from('projects').select('*').order('updated_at', { ascending: false }),
    supabase.from('tasks').select('*').order('position').order('created_at'),
  ]);
  return { today, projects: unwrap(projects, 'projects'), tasks: unwrap(tasks, 'tasks') };
}

export async function loadBudgetsWorkspace(budgetMonth?: string) {
  const { supabase, today } = await workspaceContext();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(budgetMonth ?? '') ? `${budgetMonth}-01` : `${today.slice(0, 7)}-01`;
  const [budgets, categories, actuals, budgetTotals] = await Promise.all([
    supabase.from('budgets').select('*').order('month_start', { ascending: false }),
    supabase.from('categories').select('*').order('name'),
    supabase.rpc('budget_actuals', { p_month: month }),
    supabase.rpc('budget_month_totals', { p_month: month }),
  ]);
  return {
    month,
    budgets: unwrap(budgets, 'budgets'),
    categories: unwrap(categories, 'categories'),
    actuals: unwrap(actuals, 'budget actuals'),
    budgetTotals: unwrap(budgetTotals, 'budget month totals')[0] ?? { budget: '0', spent: '0' },
  };
}

export async function loadWorkspace(period?: string, budgetMonth?: string, custom?: {from?:string;to?:string}) {
  const { supabase, today } = await workspaceContext();
  const { start, end } = periodBounds(period,today,custom);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(budgetMonth ?? '') ? `${budgetMonth}-01` : `${today.slice(0,7)}-01`;
  const [categories,transactions,budgets,projects,tasks,milestones,balances,spending,periodSpending,actuals,totals,monthly,expenseCategories] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('transactions').select('*').order('transaction_date',{ascending:false}).order('created_at',{ascending:false}).limit(5),
    supabase.from('budgets').select('*').eq('month_start',month).order('month_start',{ascending:false}),
    supabase.from('projects').select('*').order('updated_at',{ascending:false}),
    supabase.from('tasks').select('*').order('position').order('created_at'),
    supabase.from('milestones').select('*').gte('due_date',today).order('position'),
    supabase.rpc('account_balances'), supabase.rpc('project_spending'), supabase.rpc('project_spending_period',{p_start:start,p_end:end}), supabase.rpc('budget_actuals',{p_month:month}),
    supabase.rpc('period_totals',{p_start:start,p_end:end}),
    supabase.rpc('monthly_report',{p_start:start,p_end:end}),
    supabase.rpc('expense_categories',{p_start:start,p_end:end}),
  ]);
  return {
    today,start,end,month,
    categories:unwrap(categories,'categories'), transactions:unwrap(transactions,'transactions'),
    budgets:unwrap(budgets,'budgets'), projects:unwrap(projects,'projects'), tasks:unwrap(tasks,'tasks'), milestones:unwrap(milestones,'milestones'),
    balances:unwrap(balances,'account balances'), spending:unwrap(spending,'project spending'), periodSpending:unwrap(periodSpending,'period project spending'), actuals:unwrap(actuals,'budget actuals'),
    totals:unwrap(totals,'period totals')[0] ?? {income:'0',expense:'0'}, monthly:unwrap(monthly,'monthly report'), expenseCategories:unwrap(expenseCategories,'expense categories'),
  };
}
export type WorkspaceData = Awaited<ReturnType<typeof loadWorkspace>>;

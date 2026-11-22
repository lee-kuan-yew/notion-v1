-- All reporting functions are SECURITY INVOKER and scope rows to the current Auth user.
create function public.account_balances()
returns table (account_id uuid, balance text)
language sql stable security invoker set search_path = public as $$
  select a.id, (a.opening_balance + coalesce(sum(case
    when t.type = 'income' and t.account_id = a.id then t.amount
    when t.type = 'expense' and t.account_id = a.id then -t.amount
    when t.type = 'transfer' and t.to_account_id = a.id then t.amount
    when t.type = 'transfer' and t.from_account_id = a.id then -t.amount
    else 0 end),0))::text
  from public.accounts a
  left join public.transactions t on t.user_id = a.user_id
    and (t.account_id = a.id or t.from_account_id = a.id or t.to_account_id = a.id)
  where a.user_id = (select auth.uid())
  group by a.id, a.opening_balance;
$$;
create function public.project_spending()
returns table (project_id uuid, spent text)
language sql stable security invoker set search_path = public as $$
  select p.id, coalesce(sum(t.amount),0)::text
  from public.projects p left join public.transactions t
    on t.user_id = p.user_id and t.project_id = p.id and t.type = 'expense'
  where p.user_id = (select auth.uid())
  group by p.id;
$$;
create function public.budget_actuals(p_month date)
returns table (budget_id uuid, spent text)
language sql stable security invoker set search_path = public as $$
  with recursive scope as (
    select b.id as budget_id, b.user_id, b.month_start, c.id as category_id
    from public.budgets b join public.categories c on c.id = b.category_id and c.user_id = b.user_id
    where b.user_id = (select auth.uid()) and b.month_start = p_month
    union all
    select s.budget_id, s.user_id, s.month_start, c.id
    from scope s join public.categories c on c.parent_id = s.category_id and c.user_id = s.user_id
  )
  select b.id, coalesce(sum(t.amount),0)::text
  from public.budgets b left join scope s on s.budget_id = b.id
  left join public.transactions t on t.user_id = b.user_id and t.category_id = s.category_id
    and t.type = 'expense' and t.transaction_date >= b.month_start
    and t.transaction_date < (b.month_start + interval '1 month')::date
  where b.user_id = (select auth.uid()) and b.month_start = p_month
  group by b.id;
$$;
create function public.budget_month_totals(p_month date)
returns table (budget text, spent text)
language sql stable security invoker set search_path = public as $$
  with recursive scope as (
    select b.user_id, c.id as category_id
    from public.budgets b join public.categories c on c.id = b.category_id and c.user_id = b.user_id
    where b.user_id = (select auth.uid()) and b.month_start = p_month
    union
    select s.user_id, c.id from scope s join public.categories c
      on c.parent_id = s.category_id and c.user_id = s.user_id
  )
  select (select coalesce(sum(amount),0)::text from public.budgets
    where user_id = (select auth.uid()) and month_start = p_month),
    (select coalesce(sum(t.amount),0)::text from public.transactions t
      where t.user_id = (select auth.uid()) and t.type = 'expense'
      and t.transaction_date >= p_month and t.transaction_date < (p_month + interval '1 month')::date
      and exists (select 1 from scope s where s.category_id = t.category_id and s.user_id = t.user_id));
$$;
create function public.project_spending_period(p_start date, p_end date)
returns table (project_id uuid, spent text)
language sql stable security invoker set search_path = public as $$
  select p.id, coalesce(sum(t.amount),0)::text
  from public.projects p left join public.transactions t
    on t.user_id = p.user_id and t.project_id = p.id and t.type = 'expense'
    and t.transaction_date >= p_start and t.transaction_date < p_end
  where p.user_id = (select auth.uid())
  group by p.id;
$$;
create function public.period_totals(p_start date, p_end date)
returns table (income text, expense text)
language sql stable security invoker set search_path = public as $$
  select coalesce(sum(amount) filter (where type = 'income'),0)::text,
         coalesce(sum(amount) filter (where type = 'expense'),0)::text
  from public.transactions
  where user_id = (select auth.uid()) and transaction_date >= p_start and transaction_date < p_end;
$$;
create function public.monthly_report(p_start date, p_end date)
returns table (month_start date, income text, expense text)
language sql stable security invoker set search_path = public as $$
  select date_trunc('month',transaction_date)::date,
    coalesce(sum(amount) filter (where type = 'income'),0)::text,
    coalesce(sum(amount) filter (where type = 'expense'),0)::text
  from public.transactions
  where user_id = (select auth.uid()) and transaction_date >= p_start and transaction_date < p_end
  group by 1 order by 1;
$$;
create function public.expense_categories(p_start date, p_end date)
returns table (category_id uuid, spent text)
language sql stable security invoker set search_path = public as $$
  select category_id, sum(amount)::text from public.transactions
  where user_id = (select auth.uid()) and type = 'expense' and transaction_date >= p_start and transaction_date < p_end
  group by category_id order by sum(amount) desc;
$$;
revoke all on function public.account_balances() from public;
revoke all on function public.project_spending() from public;
revoke all on function public.budget_actuals(date) from public;
revoke all on function public.budget_month_totals(date) from public;
revoke all on function public.project_spending_period(date,date) from public;
revoke all on function public.period_totals(date,date) from public;
revoke all on function public.monthly_report(date,date) from public;
revoke all on function public.expense_categories(date,date) from public;
grant execute on function public.account_balances(), public.project_spending(), public.budget_actuals(date), public.budget_month_totals(date), public.project_spending_period(date,date), public.period_totals(date,date), public.monthly_report(date,date), public.expense_categories(date,date) to authenticated;

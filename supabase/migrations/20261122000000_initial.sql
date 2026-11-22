create type public.account_type as enum ('bank','cash','e_wallet','savings','other');
create type public.transaction_type as enum ('income','expense','transfer');
create type public.category_kind as enum ('income','expense');
create type public.project_status as enum ('idea','planning','active','on_hold','completed','archived');
create type public.task_status as enum ('backlog','todo','in_progress','review','done','cancelled');
create type public.priority_level as enum ('low','medium','high','urgent');
create type public.milestone_status as enum ('pending','in_progress','completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  user_id uuid not null unique references auth.users(id) on delete restrict,
  display_name text not null default '',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  currency_code text not null default 'VND' check (currency_code = 'VND'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint profile_identity check (id = user_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) > 0), account_type public.account_type not null,
  opening_balance numeric(16,2) not null default 0,
  opening_balance_date date not null default current_date,
  color text not null default '#78716C', is_archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) > 0), kind public.category_kind not null,
  parent_id uuid, icon text, color text not null default '#78716C', is_archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), unique (user_id,kind,name,parent_id),
  foreign key (user_id,parent_id) references public.categories(user_id,id) on delete restrict,
  check (parent_id is distinct from id)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) > 0), description text not null default '',
  status public.project_status not null default 'planning', priority public.priority_level not null default 'medium',
  start_date date, due_date date, budget_amount numeric(16,2) check (budget_amount >= 0),
  color text not null default '#78716C',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), check (due_date is null or start_date is null or due_date >= start_date)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  type public.transaction_type not null, amount numeric(16,2) not null check (amount > 0),
  transaction_date date not null, account_id uuid, from_account_id uuid, to_account_id uuid,
  category_id uuid, project_id uuid, payee text, description text not null default '', notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id),
  foreign key (user_id,account_id) references public.accounts(user_id,id) on delete restrict,
  foreign key (user_id,from_account_id) references public.accounts(user_id,id) on delete restrict,
  foreign key (user_id,to_account_id) references public.accounts(user_id,id) on delete restrict,
  foreign key (user_id,category_id) references public.categories(user_id,id) on delete restrict,
  foreign key (user_id,project_id) references public.projects(user_id,id) on delete restrict,
  constraint transaction_shape check (
    (type in ('income','expense') and account_id is not null and category_id is not null and from_account_id is null and to_account_id is null and (type = 'expense' or project_id is null))
    or (type = 'transfer' and account_id is null and from_account_id is not null and to_account_id is not null and from_account_id <> to_account_id and category_id is null and project_id is null)
  )
);
create table public.budgets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  category_id uuid not null, month_start date not null, amount numeric(16,2) not null check (amount > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), unique (user_id,category_id,month_start),
  foreign key (user_id,category_id) references public.categories(user_id,id) on delete restrict,
  check (extract(day from month_start) = 1)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid, title text not null check (length(trim(title)) > 0), description text not null default '',
  status public.task_status not null default 'todo', priority public.priority_level not null default 'medium',
  start_date date, due_date date, estimated_cost numeric(16,2) check (estimated_cost >= 0),
  position integer not null default 0 check (position >= 0), completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), foreign key (user_id,project_id) references public.projects(user_id,id) on delete restrict,
  check (due_date is null or start_date is null or due_date >= start_date)
);
create table public.milestones (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null, title text not null check (length(trim(title)) > 0), description text not null default '',
  due_date date, status public.milestone_status not null default 'pending', position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), foreign key (user_id,project_id) references public.projects(user_id,id) on delete restrict
);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create function public.validate_category() returns trigger language plpgsql as $$
declare parent_kind public.category_kind;
begin
  if new.parent_id is not null then
    select kind into parent_kind from public.categories where id = new.parent_id and user_id = new.user_id;
    if parent_kind is null or parent_kind <> new.kind then raise exception 'Parent category must have the same owner and kind'; end if;
    if exists (with recursive ancestry as (
      select id,parent_id from public.categories where id = new.parent_id and user_id = new.user_id
      union all select c.id,c.parent_id from public.categories c join ancestry a on c.id = a.parent_id and c.user_id = new.user_id
    ) select 1 from ancestry where id = new.id) then raise exception 'Category cycle'; end if;
  end if;
  if tg_op = 'UPDATE' and old.kind <> new.kind and (exists(select 1 from public.transactions where category_id = new.id) or exists(select 1 from public.budgets where category_id = new.id) or exists(select 1 from public.categories where parent_id = new.id)) then
    raise exception 'Cannot change kind of a referenced category';
  end if;
  return new;
end $$;
create function public.validate_transaction_category() returns trigger language plpgsql as $$
declare category_type public.category_kind;
begin
  if new.type <> 'transfer' then
    select kind into category_type from public.categories where id = new.category_id and user_id = new.user_id;
    if category_type is null or category_type::text <> new.type::text then raise exception 'Transaction category kind does not match type'; end if;
  end if;
  return new;
end $$;
create function public.validate_budget_category() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.categories where id = new.category_id and user_id = new.user_id and kind = 'expense') then
    raise exception 'Budget category must be an expense category';
  end if;
  return new;
end $$;
create function public.sync_task_completion() returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then new.completed_at = now();
  elsif new.status <> 'done' then new.completed_at = null; end if;
  return new;
end $$;

create trigger categories_validate before insert or update on public.categories for each row execute function public.validate_category();
create trigger transactions_validate before insert or update on public.transactions for each row execute function public.validate_transaction_category();
create trigger budgets_validate before insert or update on public.budgets for each row execute function public.validate_budget_category();
create trigger tasks_completion before insert or update on public.tasks for each row execute function public.sync_task_completion();
do $$ declare t text; begin
  foreach t in array array['profiles','accounts','categories','transactions','budgets','projects','tasks','milestones'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
  end loop;
end $$;

create index accounts_owner_idx on public.accounts(user_id);
create index categories_owner_kind_idx on public.categories(user_id,kind);
create index transactions_owner_date_idx on public.transactions(user_id,transaction_date desc);
create index transactions_owner_account_idx on public.transactions(user_id,account_id);
create index transactions_owner_from_idx on public.transactions(user_id,from_account_id);
create index transactions_owner_to_idx on public.transactions(user_id,to_account_id);
create index transactions_owner_project_idx on public.transactions(user_id,project_id) where project_id is not null;
create index transactions_owner_category_idx on public.transactions(user_id,category_id);
create index budgets_owner_month_idx on public.budgets(user_id,month_start);
create index projects_owner_status_idx on public.projects(user_id,status);
create index projects_owner_due_idx on public.projects(user_id,due_date);
create index tasks_owner_status_position_idx on public.tasks(user_id,status,position);
create index tasks_owner_project_idx on public.tasks(user_id,project_id);
create index tasks_owner_due_idx on public.tasks(user_id,due_date);
create index milestones_owner_project_idx on public.milestones(user_id,project_id);
create index milestones_owner_due_idx on public.milestones(user_id,due_date);

do $$ declare t text; begin
  foreach t in array array['profiles','accounts','categories','transactions','budgets','projects','tasks','milestones'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles,public.accounts,public.categories,public.transactions,public.budgets,public.projects,public.tasks,public.milestones to authenticated;
revoke all on public.profiles,public.accounts,public.categories,public.transactions,public.budgets,public.projects,public.tasks,public.milestones from anon;

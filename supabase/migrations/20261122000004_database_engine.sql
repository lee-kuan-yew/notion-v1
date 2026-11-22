-- Keep business amounts, dates and relations in their existing typed columns.
alter table public.accounts add column custom_properties jsonb not null default '{}'::jsonb;
alter table public.categories add column custom_properties jsonb not null default '{}'::jsonb;
alter table public.transactions add column custom_properties jsonb not null default '{}'::jsonb;
alter table public.budgets add column custom_properties jsonb not null default '{}'::jsonb;
alter table public.projects add column custom_properties jsonb not null default '{}'::jsonb;
alter table public.tasks add column custom_properties jsonb not null default '{}'::jsonb;
alter table public.milestones add column custom_properties jsonb not null default '{}'::jsonb;

create table public.database_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  database_key text not null check (database_key in ('accounts','categories','transactions','budgets','projects','tasks','milestones')),
  property_key text not null check (property_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  property_name text not null check (length(trim(property_name)) between 1 and 120),
  property_type text not null check (property_type in ('title','text','number','currency','select','multi_select','status','date','checkbox','relation','url','formula','created_time','last_edited_time')),
  position integer not null default 0 check (position >= 0),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  is_system_property boolean not null default false,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), unique (user_id,database_key,property_key)
);
create table public.database_property_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  property_id uuid not null,
  label text not null check (length(trim(label)) between 1 and 80),
  color text not null default '#78716C' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), unique (property_id,label),
  foreign key (user_id,property_id) references public.database_properties(user_id,id) on delete cascade
);
create table public.database_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  database_key text not null check (database_key in ('accounts','categories','transactions','budgets','projects','tasks','milestones')),
  view_name text not null check (length(trim(view_name)) between 1 and 120),
  view_type text not null check (view_type in ('table','board','calendar')),
  filters jsonb not null default '{"logic":"and","rules":[]}'::jsonb check (jsonb_typeof(filters) = 'object'),
  sorts jsonb not null default '[]'::jsonb check (jsonb_typeof(sorts) = 'array'),
  group_by text,
  visible_properties jsonb not null default '[]'::jsonb check (jsonb_typeof(visible_properties) = 'array'),
  column_widths jsonb not null default '{}'::jsonb check (jsonb_typeof(column_widths) = 'object'),
  column_order jsonb not null default '[]'::jsonb check (jsonb_typeof(column_order) = 'array'),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), unique (user_id,database_key,view_name)
);
create table public.tag_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 80),
  color text not null default '#78716C' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), unique (user_id,name)
);
do $$ declare entry text; relation text; begin
  foreach entry in array array['accounts','categories','transactions','budgets','projects','tasks','milestones'] loop
    relation := case when entry='categories' then 'category_tags' else left(entry,length(entry)-1) || '_tags' end;
    execute format('create table public.%I (
      user_id uuid not null references auth.users(id) on delete restrict,
      record_id uuid not null,
      tag_id uuid not null,
      created_at timestamptz not null default now(),
      primary key (user_id,record_id,tag_id),
      foreign key (user_id,record_id) references public.%I(user_id,id) on delete cascade,
      foreign key (user_id,tag_id) references public.tag_options(user_id,id) on delete cascade
    )',relation,entry);
  end loop;
end $$;
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  title text not null default 'Không có tiêu đề' check (length(title) <= 200),
  content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id)
);
create table public.record_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  database_key text not null check (database_key in ('accounts','categories','transactions','budgets','projects','tasks','milestones')),
  record_id uuid not null,
  content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id,id), unique (user_id,database_key,record_id)
);
create function public.validate_record_document() returns trigger language plpgsql security invoker set search_path=public as $$
declare found_record boolean;
begin
  execute format('select exists(select 1 from public.%I where user_id=$1 and id=$2)',new.database_key)
    into found_record using new.user_id,new.record_id;
  if not found_record then raise exception 'Record does not belong to document owner'; end if;
  return new;
end $$;
create trigger record_document_owner before insert or update on public.record_documents for each row execute function public.validate_record_document();
create function public.delete_record_document() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  delete from public.record_documents where user_id=old.user_id and database_key=tg_table_name and record_id=old.id;
  return old;
end $$;
do $$ declare entry text; begin
  foreach entry in array array['accounts','categories','transactions','budgets','projects','tasks','milestones'] loop
    execute format('create trigger delete_record_document after delete on public.%I for each row execute function public.delete_record_document()',entry);
  end loop;
end $$;

create function public.validate_custom_properties() returns trigger language plpgsql security invoker set search_path=public as $$
declare item record; property record; kind text;
begin
  if jsonb_typeof(new.custom_properties) <> 'object' then raise exception 'Custom properties must be an object'; end if;
  for item in select key,value from jsonb_each(new.custom_properties) loop
    select property_type into property from public.database_properties
      where user_id=new.user_id and database_key=tg_table_name and property_key=item.key and not is_system_property;
    if not found then raise exception 'Unknown custom property %',item.key; end if;
    kind := jsonb_typeof(item.value);
    if kind <> 'null' and not (
      (property.property_type in ('title','text','select','status','date','relation','url') and kind='string') or
      (property.property_type in ('number','currency') and kind='number') or
      (property.property_type='checkbox' and kind='boolean') or
      (property.property_type='multi_select' and kind='array')
    ) then raise exception 'Invalid value for custom property %',item.key; end if;
  end loop;
  return new;
end $$;
do $$ declare entry text; begin
  foreach entry in array array['accounts','categories','transactions','budgets','projects','tasks','milestones'] loop
    execute format('create trigger validate_custom_properties before insert or update of custom_properties on public.%I for each row execute function public.validate_custom_properties()',entry);
  end loop;
end $$;
create function public.set_custom_property(p_database_key text,p_record_id uuid,p_property_key text,p_value jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if p_database_key not in ('accounts','categories','transactions','budgets','projects','tasks','milestones') then raise exception 'Invalid database'; end if;
  if not exists(select 1 from public.database_properties where user_id=auth.uid() and database_key=p_database_key and property_key=p_property_key and not is_system_property) then
    raise exception 'Unknown custom property';
  end if;
  execute format('update public.%I set custom_properties=jsonb_set(custom_properties,array[$1],$2,true) where id=$3 and user_id=auth.uid()',p_database_key)
    using p_property_key,p_value,p_record_id;
  if not found then raise exception 'Record not found'; end if;
end $$;
revoke all on function public.set_custom_property(text,uuid,text,jsonb) from public;
grant execute on function public.set_custom_property(text,uuid,text,jsonb) to authenticated;
create function public.delete_custom_property(p_property_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare property record;
begin
  select database_key,property_key,is_system_property into property from public.database_properties where id=p_property_id and user_id=auth.uid();
  if not found or property.is_system_property then raise exception 'Custom property not found'; end if;
  execute format('update public.%I set custom_properties=custom_properties - $1 where user_id=auth.uid() and custom_properties ? $1',property.database_key)
    using property.property_key;
  delete from public.database_properties where id=p_property_id and user_id=auth.uid();
end $$;
revoke all on function public.delete_custom_property(uuid) from public;
grant execute on function public.delete_custom_property(uuid) to authenticated;

do $$ declare entry text; begin
  foreach entry in array array['database_properties','database_property_options','database_views','tag_options','account_tags','category_tags','transaction_tags','budget_tags','project_tags','task_tags','milestone_tags','pages','record_documents'] loop
    execute format('alter table public.%I enable row level security',entry);
    execute format('create policy owner_all on public.%I for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',entry);
    execute format('grant select,insert,update,delete on public.%I to authenticated',entry);
    execute format('revoke all on public.%I from anon',entry);
  end loop;
end $$;
do $$ declare entry text; begin
  foreach entry in array array['database_properties','database_property_options','database_views','tag_options','pages','record_documents'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',entry);
  end loop;
end $$;
create index database_properties_owner_key on public.database_properties(user_id,database_key,position);
create index database_views_owner_key on public.database_views(user_id,database_key);
create index tag_options_owner on public.tag_options(user_id,name);
create index record_documents_owner_record on public.record_documents(user_id,database_key,record_id);

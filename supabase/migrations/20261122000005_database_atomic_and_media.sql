-- Atomic bulk operations, property type conversion, status groups, and RLS-protected media uploads.

alter table public.database_property_options
  add column if not exists status_group text not null default 'todo'
  check (status_group in ('todo', 'in_progress', 'complete'));

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  filename text not null check (length(trim(filename)) between 1 and 200),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 2097152),
  data_base64 text not null check (length(data_base64) > 0 and length(data_base64) <= 3000000),
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

alter table public.media_assets enable row level security;
drop policy if exists owner_all on public.media_assets;
create policy owner_all on public.media_assets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.media_assets to authenticated;
revoke all on public.media_assets from anon;
create index if not exists media_assets_owner_idx on public.media_assets(user_id, created_at desc);

create or replace function public.set_custom_property(p_database_key text, p_record_id uuid, p_property_key text, p_value jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_database_key not in ('accounts','categories','transactions','budgets','projects','tasks','milestones') then
    raise exception 'Invalid database';
  end if;
  if not exists(select 1 from public.database_properties where user_id = auth.uid() and database_key = p_database_key and property_key = p_property_key and not is_system_property) then
    raise exception 'Unknown custom property';
  end if;
  execute format('update public.%I set custom_properties = jsonb_set(custom_properties, array[$1], $2, true) where id = $3 and user_id = auth.uid()', p_database_key)
    using p_property_key, p_value, p_record_id;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Record not found';
  end if;
end $$;

revoke all on function public.set_custom_property(text, uuid, text, jsonb) from public;
grant execute on function public.set_custom_property(text, uuid, text, jsonb) to authenticated;

create or replace function public.bulk_delete_records(p_database_key text, p_record_ids jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids uuid[];
  v_deleted integer;
begin
  if p_database_key not in ('accounts','categories','transactions','budgets','projects','tasks','milestones') then
    raise exception 'Invalid database';
  end if;
  if jsonb_typeof(p_record_ids) <> 'array' or jsonb_array_length(p_record_ids) = 0 or jsonb_array_length(p_record_ids) > 100 then
    raise exception 'Invalid record list';
  end if;
  select array(select distinct jsonb_array_elements_text(p_record_ids)::uuid) into v_ids;
  execute format('delete from public.%I where user_id = auth.uid() and id = any($1)', p_database_key)
    using v_ids;
  get diagnostics v_deleted = row_count;
  if v_deleted <> array_length(v_ids, 1) then
    raise exception 'One or more records were not found';
  end if;
  return v_deleted;
end $$;

revoke all on function public.bulk_delete_records(text, jsonb) from public;
grant execute on function public.bulk_delete_records(text, jsonb) to authenticated;

create or replace function public.bulk_update_records(p_database_key text, p_record_ids jsonb, p_property_key text, p_value jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids uuid[];
  v_prop record;
  v_updated integer;
  v_text text;
  v_is_null boolean;
begin
  if p_database_key not in ('accounts','categories','transactions','budgets','projects','tasks','milestones') then
    raise exception 'Invalid database';
  end if;
  if jsonb_typeof(p_record_ids) <> 'array' or jsonb_array_length(p_record_ids) = 0 or jsonb_array_length(p_record_ids) > 100 then
    raise exception 'Invalid record list';
  end if;
  select array(select distinct jsonb_array_elements_text(p_record_ids)::uuid) into v_ids;

  select * into v_prop from public.database_properties
    where user_id = auth.uid() and database_key = p_database_key and property_key = p_property_key;
  if not found then
    raise exception 'Unknown property %', p_property_key;
  end if;

  if not v_prop.is_system_property then
    execute format(
      'update public.%I set custom_properties = jsonb_set(custom_properties, array[$1], $2, true) where user_id = auth.uid() and id = any($3)',
      p_database_key
    ) using p_property_key, p_value, v_ids;
    get diagnostics v_updated = row_count;
    if v_updated <> array_length(v_ids, 1) then
      raise exception 'One or more records were not found';
    end if;
    return v_updated;
  end if;

  v_is_null := (p_value is null or jsonb_typeof(p_value) = 'null');
  v_text := case when v_is_null then null else p_value #>> '{}' end;

  if p_database_key = 'transactions' and p_property_key in ('description','payee') then
    execute format('update public.transactions set %I = $1 where user_id = auth.uid() and id = any($2)', p_property_key)
      using v_text, v_ids;
  elsif p_database_key = 'transactions' and p_property_key = 'transaction_date' then
    update public.transactions set transaction_date = v_text::date where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'transactions' and p_property_key = 'amount' then
    update public.transactions set amount = v_text::numeric(16,2) where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'transactions' and p_property_key in ('category_id','account_id','project_id') then
    execute format('update public.transactions set %I = $1 where user_id = auth.uid() and id = any($2)', p_property_key)
      using v_text::uuid, v_ids;
  elsif p_database_key = 'accounts' and p_property_key = 'name' then
    update public.accounts set name = v_text where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'accounts' and p_property_key = 'account_type' then
    update public.accounts set account_type = v_text::public.account_type where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'accounts' and p_property_key = 'opening_balance' then
    update public.accounts set opening_balance = v_text::numeric(16,2) where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'accounts' and p_property_key = 'opening_balance_date' then
    update public.accounts set opening_balance_date = v_text::date where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'accounts' and p_property_key = 'is_archived' then
    update public.accounts set is_archived = (p_value::text)::boolean where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'budgets' and p_property_key = 'category_id' then
    update public.budgets set category_id = v_text::uuid where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'budgets' and p_property_key = 'month_start' then
    update public.budgets set month_start = v_text::date where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'budgets' and p_property_key = 'amount' then
    update public.budgets set amount = v_text::numeric(16,2) where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'categories' and p_property_key in ('name','color') then
    execute format('update public.categories set %I = $1 where user_id = auth.uid() and id = any($2)', p_property_key)
      using v_text, v_ids;
  elsif p_database_key = 'categories' and p_property_key = 'parent_id' then
    update public.categories set parent_id = v_text::uuid where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'categories' and p_property_key = 'is_archived' then
    update public.categories set is_archived = (p_value::text)::boolean where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'projects' and p_property_key in ('name','description') then
    execute format('update public.projects set %I = $1 where user_id = auth.uid() and id = any($2)', p_property_key)
      using v_text, v_ids;
  elsif p_database_key = 'projects' and p_property_key = 'status' then
    update public.projects set status = v_text::public.project_status where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'projects' and p_property_key = 'priority' then
    update public.projects set priority = v_text::public.priority_level where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'projects' and p_property_key in ('start_date','due_date') then
    execute format('update public.projects set %I = $1 where user_id = auth.uid() and id = any($2)', p_property_key)
      using v_text::date, v_ids;
  elsif p_database_key = 'projects' and p_property_key = 'budget_amount' then
    update public.projects set budget_amount = v_text::numeric(16,2) where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'tasks' and p_property_key in ('title','description') then
    execute format('update public.tasks set %I = $1 where user_id = auth.uid() and id = any($2)', p_property_key)
      using v_text, v_ids;
  elsif p_database_key = 'tasks' and p_property_key = 'project_id' then
    update public.tasks set project_id = v_text::uuid where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'tasks' and p_property_key = 'status' then
    update public.tasks set status = v_text::public.task_status where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'tasks' and p_property_key = 'priority' then
    update public.tasks set priority = v_text::public.priority_level where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'tasks' and p_property_key in ('start_date','due_date') then
    execute format('update public.tasks set %I = $1 where user_id = auth.uid() and id = any($2)', p_property_key)
      using v_text::date, v_ids;
  elsif p_database_key = 'tasks' and p_property_key = 'estimated_cost' then
    update public.tasks set estimated_cost = v_text::numeric(16,2) where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'milestones' and p_property_key = 'title' then
    update public.milestones set title = v_text where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'milestones' and p_property_key = 'project_id' then
    update public.milestones set project_id = v_text::uuid where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'milestones' and p_property_key = 'status' then
    update public.milestones set status = v_text::public.milestone_status where user_id = auth.uid() and id = any(v_ids);
  elsif p_database_key = 'milestones' and p_property_key = 'due_date' then
    update public.milestones set due_date = v_text::date where user_id = auth.uid() and id = any(v_ids);
  else
    raise exception 'Property % cannot be bulk updated', p_property_key;
  end if;

  get diagnostics v_updated = row_count;
  if v_updated <> array_length(v_ids, 1) then
    raise exception 'One or more records were not found';
  end if;
  return v_updated;
end $$;

revoke all on function public.bulk_update_records(text, jsonb, text, jsonb) from public;
grant execute on function public.bulk_update_records(text, jsonb, text, jsonb) to authenticated;

create or replace function public.convert_custom_property_type(
  p_property_id uuid,
  p_new_type text,
  p_new_name text,
  p_visible boolean,
  p_position integer,
  p_configuration jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prop record;
  v_row record;
  v_val jsonb;
  v_converted jsonb;
  v_str text;
begin
  select * into v_prop from public.database_properties
    where id = p_property_id and user_id = auth.uid();
  if not found or v_prop.is_system_property then
    raise exception 'Custom property not found';
  end if;

  if v_prop.property_type = p_new_type then
    update public.database_properties
      set property_name = p_new_name, position = p_position, is_visible = p_visible, configuration = p_configuration
      where id = p_property_id and user_id = auth.uid();
    return;
  end if;

  -- Update metadata first (transaction rolls back if any row conversion fails validation)
  update public.database_properties
    set property_name = p_new_name, property_type = p_new_type, position = p_position, is_visible = p_visible, configuration = p_configuration
    where id = p_property_id and user_id = auth.uid();

  for v_row in execute format(
    'select id, custom_properties -> $1 as val from public.%I where user_id = auth.uid() and custom_properties ? $1',
    v_prop.database_key
  ) using v_prop.property_key loop
    v_val := v_row.val;
    if v_val is null or jsonb_typeof(v_val) = 'null' then
      continue;
    end if;

    if p_new_type in ('title','text') then
      if jsonb_typeof(v_val) in ('string','number','boolean') then
        v_converted := to_jsonb(v_val #>> '{}');
      else
        raise exception 'Cannot convert existing value to text';
      end if;
    elsif p_new_type = 'url' then
      if jsonb_typeof(v_val) = 'string' and (v_val #>> '{}') ~* '^https?://' then
        v_converted := v_val;
      else
        raise exception 'Existing values must be valid http/https URLs';
      end if;
    elsif p_new_type in ('number','currency') then
      if jsonb_typeof(v_val) = 'number' then
        v_converted := v_val;
      elsif jsonb_typeof(v_val) = 'string' and (v_val #>> '{}') ~ '^-?[0-9]{1,13}(\.[0-9]{1,2})?$' then
        v_converted := to_jsonb((v_val #>> '{}')::numeric);
      else
        raise exception 'Existing values cannot be converted to number';
      end if;
    elsif p_new_type = 'date' then
      if jsonb_typeof(v_val) = 'string' and (v_val #>> '{}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        v_converted := v_val;
      else
        raise exception 'Existing values are not valid YYYY-MM-DD dates';
      end if;
    elsif p_new_type = 'checkbox' then
      if jsonb_typeof(v_val) = 'boolean' then
        v_converted := v_val;
      else
        raise exception 'Existing values cannot be converted to checkbox';
      end if;
    elsif p_new_type in ('select','status') then
      if v_prop.property_type in ('select','status') and jsonb_typeof(v_val) = 'string' then
        v_converted := v_val;
      elsif v_prop.property_type = 'multi_select' and jsonb_typeof(v_val) = 'array' and jsonb_array_length(v_val) <= 1 then
        v_converted := case when jsonb_array_length(v_val) = 1 then v_val -> 0 else 'null'::jsonb end;
      else
        raise exception 'Existing values cannot be converted to single selection';
      end if;
    elsif p_new_type = 'multi_select' then
      if v_prop.property_type in ('select','status') and jsonb_typeof(v_val) = 'string' then
        v_converted := jsonb_build_array(v_val);
      elsif jsonb_typeof(v_val) = 'array' then
        v_converted := v_val;
      else
        raise exception 'Existing values cannot be converted to multi-select';
      end if;
    elsif p_new_type = 'formula' then
      -- Clear stored custom values only if rows have none; reject if data exists to avoid silent loss
      raise exception 'Cannot convert property with existing data to formula';
    else
      raise exception 'Incompatible property type conversion';
    end if;

    execute format(
      'update public.%I set custom_properties = jsonb_set(custom_properties, array[$1], $2, true) where id = $3 and user_id = auth.uid()',
      v_prop.database_key
    ) using v_prop.property_key, v_converted, v_row.id;
  end loop;
end $$;

revoke all on function public.convert_custom_property_type(uuid, text, text, boolean, integer, jsonb) from public;
grant execute on function public.convert_custom_property_type(uuid, text, text, boolean, integer, jsonb) to authenticated;

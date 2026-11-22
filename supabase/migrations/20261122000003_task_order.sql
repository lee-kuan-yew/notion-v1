create function public.reorder_tasks(p_updates jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare total integer;
begin
  if auth.uid() is null or jsonb_typeof(p_updates) <> 'array' then raise exception 'Invalid task order'; end if;
  total := jsonb_array_length(p_updates);
  if total > 500 then raise exception 'Too many tasks in one reorder'; end if;
  if (select count(*) from jsonb_array_elements(p_updates) e where not exists (
    select 1 from public.tasks t where t.id = (e->>'id')::uuid and t.user_id = auth.uid()
  )) > 0 then raise exception 'Task ownership mismatch'; end if;
  update public.tasks t set status = (e.value->>'status')::public.task_status,
    position = (e.value->>'position')::integer
  from jsonb_array_elements(p_updates) e
  where t.id = (e.value->>'id')::uuid and t.user_id = auth.uid();
end $$;
revoke all on function public.reorder_tasks(jsonb) from public;
grant execute on function public.reorder_tasks(jsonb) to authenticated;

create unique index categories_unique_name_per_parent on public.categories(user_id,kind,name,parent_id) nulls not distinct;
create function public.initialize_owner()
returns void language plpgsql security invoker set search_path = public as $$
declare created uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.profiles(id,user_id) values (auth.uid(),auth.uid()) on conflict (id) do nothing returning id into created;
  if created is null then return; end if;
  insert into public.categories(user_id,name,kind,icon,color) values
    (auth.uid(),'Lương','income','BriefcaseBusiness','#16A34A'),
    (auth.uid(),'Thu nhập khác','income','Plus','#16A34A'),
    (auth.uid(),'Ăn uống','expense','Utensils','#D97706'),
    (auth.uid(),'Di chuyển','expense','Car','#78716C'),
    (auth.uid(),'Nhà ở','expense','House','#78716C'),
    (auth.uid(),'Mua sắm','expense','ShoppingBag','#78716C'),
    (auth.uid(),'Dự án','expense','FolderKanban','#78716C')
  on conflict do nothing;
end $$;
revoke all on function public.initialize_owner() from public;
grant execute on function public.initialize_owner() to authenticated;

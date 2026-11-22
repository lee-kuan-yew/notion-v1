-- Cover the owner-scoped sort and report paths used by the web application.
create index if not exists transactions_owner_date_created_idx
  on public.transactions(user_id, transaction_date desc, created_at desc);

create index if not exists transactions_owner_type_date_idx
  on public.transactions(user_id, type, transaction_date desc)
  include (amount, category_id, project_id);

create index if not exists projects_owner_updated_idx
  on public.projects(user_id, updated_at desc);

create index if not exists tasks_owner_position_created_idx
  on public.tasks(user_id, position, created_at);

create index if not exists milestones_owner_position_idx
  on public.milestones(user_id, position);

create index if not exists pages_owner_updated_idx
  on public.pages(user_id, updated_at desc);

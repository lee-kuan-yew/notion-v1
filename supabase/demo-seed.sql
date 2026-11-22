-- Demo data for the owner account. Run in Supabase SQL Editor (runs as postgres, bypasses RLS).
do $$
declare
  u uuid := 'c8fb4d8f-67d7-4a2c-acd1-bb0b6a3e8b47';
  m date := date_trunc('month', current_date)::date;
  a_bank uuid; a_cash uuid; a_wallet uuid; a_save uuid;
  p1 uuid; p2 uuid; p3 uuid;
  c_salary uuid; c_other uuid; c_food uuid; c_move uuid; c_home uuid; c_shop uuid; c_proj uuid;
begin
  insert into public.profiles(id,user_id,display_name) values (u,u,'Phúc Lộc') on conflict (id) do nothing;
  insert into public.categories(user_id,name,kind,icon,color) values
    (u,'Lương','income','BriefcaseBusiness','#16A34A'),(u,'Thu nhập khác','income','Plus','#16A34A'),
    (u,'Ăn uống','expense','Utensils','#D97706'),(u,'Di chuyển','expense','Car','#78716C'),
    (u,'Nhà ở','expense','House','#78716C'),(u,'Mua sắm','expense','ShoppingBag','#78716C'),
    (u,'Dự án','expense','FolderKanban','#78716C') on conflict do nothing;
  select id into c_salary from public.categories where user_id=u and name='Lương' and kind='income';
  select id into c_other  from public.categories where user_id=u and name='Thu nhập khác' and kind='income';
  select id into c_food   from public.categories where user_id=u and name='Ăn uống' and kind='expense';
  select id into c_move   from public.categories where user_id=u and name='Di chuyển' and kind='expense';
  select id into c_home   from public.categories where user_id=u and name='Nhà ở' and kind='expense';
  select id into c_shop   from public.categories where user_id=u and name='Mua sắm' and kind='expense';
  select id into c_proj   from public.categories where user_id=u and name='Dự án' and kind='expense';

  insert into public.accounts(user_id,name,account_type,opening_balance,opening_balance_date,color) values (u,'Vietcombank','bank',20000000,m-60,'#2563EB') returning id into a_bank;
  insert into public.accounts(user_id,name,account_type,opening_balance,opening_balance_date,color) values (u,'Tiền mặt','cash',2000000,m-60,'#16A34A') returning id into a_cash;
  insert into public.accounts(user_id,name,account_type,opening_balance,opening_balance_date,color) values (u,'MoMo','e_wallet',1500000,m-60,'#DB2777') returning id into a_wallet;
  insert into public.accounts(user_id,name,account_type,opening_balance,opening_balance_date,color) values (u,'Tiết kiệm','savings',50000000,m-60,'#D97706') returning id into a_save;

  insert into public.projects(user_id,name,description,status,priority,start_date,due_date,budget_amount,color) values (u,'Website cá nhân','Thiết kế và xây dựng portfolio','active','high',m-10,m+40,15000000,'#2563EB') returning id into p1;
  insert into public.projects(user_id,name,description,status,priority,start_date,due_date,budget_amount,color) values (u,'Học tiếng Anh IELTS','Mục tiêu 7.0 trong 6 tháng','active','medium',m-30,m+150,12000000,'#16A34A') returning id into p2;
  insert into public.projects(user_id,name,description,status,priority,start_date,due_date,budget_amount,color) values (u,'Chuyến đi Đà Lạt','Du lịch cuối năm','planning','low',m,m+45,8000000,'#D97706') returning id into p3;

  insert into public.transactions(user_id,type,amount,transaction_date,account_id,category_id,payee,description) values
    (u,'income',25000000,m+1,a_bank,c_salary,'Công ty','Lương tháng'),
    (u,'income',3000000,m+8,a_bank,c_other,'Khách hàng','Freelance thiết kế'),
    (u,'expense',4500000,m+2,a_bank,c_home,'Chủ nhà','Tiền thuê nhà'),
    (u,'expense',185000,m+3,a_wallet,c_food,'Highlands','Cà phê'),
    (u,'expense',320000,m+4,a_cash,c_food,'Quán cơm','Ăn trưa tuần'),
    (u,'expense',650000,m+5,a_wallet,c_move,'Grab','Đi lại'),
    (u,'expense',1200000,m+6,a_bank,c_shop,'Shopee','Mua sắm'),
    (u,'expense',2500000,m+7,a_bank,c_proj,'Namecheap','Tên miền và hosting')
  ;
  insert into public.transactions(user_id,type,amount,transaction_date,from_account_id,to_account_id,description) values
    (u,'transfer',5000000,m+9,a_bank,a_save,'Gửi tiết kiệm');
  update public.transactions set project_id=p1 where user_id=u and description='Tên miền và hosting';

  insert into public.budgets(user_id,category_id,month_start,amount) values
    (u,c_food,m,3000000),(u,c_move,m,1500000),(u,c_shop,m,2000000),(u,c_home,m,4500000) on conflict do nothing;

  insert into public.tasks(user_id,project_id,title,status,priority,due_date,estimated_cost,position) values
    (u,p1,'Thiết kế wireframe','done','high',m+3,0,0),
    (u,p1,'Xây dựng trang chủ','in_progress','high',m+14,2000000,1),
    (u,p1,'Viết nội dung portfolio','todo','medium',m+21,0,2),
    (u,p2,'Đăng ký khoá luyện thi','todo','medium',m+7,5000000,0),
    (u,p2,'Làm đề Reading tuần 1','in_progress','medium',m+5,0,1),
    (u,p3,'Đặt phòng khách sạn','backlog','low',m+30,3000000,0),
    (u,null,'Đóng tiền điện nước','todo','urgent',m+2,600000,0);

  insert into public.milestones(user_id,project_id,title,due_date,status,position) values
    (u,p1,'Ra mắt bản beta',m+30,'in_progress',0),(u,p2,'Thi thử lần 1',m+60,'pending',0),(u,p3,'Chốt lịch trình',m+20,'pending',0);
end $$;

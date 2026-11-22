import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const owner='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const db=new PGlite();
const query=(sql,params=[])=>db.query(sql,params);
const one=async(sql,params=[])=>(await query(sql,params)).rows[0];
const claim=async(id)=>{await query('select set_config($1,$2,false)',['request.jwt.claim.sub',id]);};
const reject=async(sql,params=[])=>assert.rejects(query(sql,params));
try {
 await db.exec(`create schema auth;
 create table auth.users (id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create role authenticated; create role anon;
 insert into auth.users values ('${owner}'),('${outsider}');`);
 for(const file of readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  process.stdout.write(`Migration ${file}: OK\n`);
 }
 await db.exec('grant usage on schema public,auth to authenticated,anon; grant all on all tables in schema public to authenticated,anon; set role authenticated;');
 await claim(owner);
 await query('select public.initialize_owner()');
 await query('select public.initialize_owner()');
 assert.equal((await one('select count(*)::int as n from public.categories')).n,7,'first-user initialization is idempotent');
 await query("delete from public.categories where name='Mua sắm'");
 await query('select public.initialize_owner()');
 assert.equal((await one('select count(*)::int as n from public.categories')).n,6,'owner deletion is not undone by initialization');
 const incomeCategory=(await one("select id from public.categories where name='Lương'")).id;
 const parentCategory=(await one("select id from public.categories where name='Dự án'")).id;
 const childCategory=(await one('insert into public.categories(user_id,name,kind,parent_id) values ($1,$2,$3,$4) returning id',[owner,'Marketing','expense',parentCategory])).id;
 const accountA=(await one('insert into public.accounts(user_id,name,account_type,opening_balance,opening_balance_date) values ($1,$2,$3,$4,$5) returning id',[owner,'Bank','bank',100,'2026-11-01'])).id;
 const accountB=(await one('insert into public.accounts(user_id,name,account_type,opening_balance,opening_balance_date) values ($1,$2,$3,$4,$5) returning id',[owner,'Cash','cash',0,'2026-11-01'])).id;
 const project=(await one('insert into public.projects(user_id,name,budget_amount) values ($1,$2,$3) returning id',[owner,'Website',100])).id;
 const budgetParent=(await one('insert into public.budgets(user_id,category_id,month_start,amount) values ($1,$2,$3,$4) returning id',[owner,parentCategory,'2026-11-01',100])).id;
 const budgetChild=(await one('insert into public.budgets(user_id,category_id,month_start,amount) values ($1,$2,$3,$4) returning id',[owner,childCategory,'2026-11-01',50])).id;
 await query('insert into public.transactions(user_id,type,amount,transaction_date,account_id,category_id) values ($1,$2,$3,$4,$5,$6)',[owner,'income',100,'2026-11-10',accountA,incomeCategory]);
 const expense=(await one('insert into public.transactions(user_id,type,amount,transaction_date,account_id,category_id,project_id) values ($1,$2,$3,$4,$5,$6,$7) returning id',[owner,'expense',20,'2026-11-15',accountA,childCategory,project])).id;
 await query('insert into public.transactions(user_id,type,amount,transaction_date,from_account_id,to_account_id) values ($1,$2,$3,$4,$5,$6)',[owner,'transfer',30,'2026-11-16',accountA,accountB]);
 const balances=(await query('select * from public.account_balances()')).rows;
 assert.equal(balances.find(b=>b.account_id===accountA).balance,'150.00');
 assert.equal(balances.find(b=>b.account_id===accountB).balance,'30.00');
 const totals=await one('select * from public.period_totals($1,$2)',['2026-11-01','2026-12-01']);
 assert.equal(totals.income,'100.00');assert.equal(totals.expense,'20.00','transfer must not count as expense');
 assert.equal((await one('select * from public.project_spending() where project_id=$1',[project])).spent,'20.00');
 const actuals=(await query('select * from public.budget_actuals($1)',['2026-11-01'])).rows;
 assert.equal(actuals.find(b=>b.budget_id===budgetParent).spent,'20.00','parent includes child expenses');
 assert.equal(actuals.find(b=>b.budget_id===budgetChild).spent,'20.00');
 const budgetTotals=await one('select * from public.budget_month_totals($1)',['2026-11-01']);
 assert.equal(budgetTotals.budget,'150.00');assert.equal(budgetTotals.spent,'20.00','overlapping budgets must not double count expense');
 await reject('insert into public.transactions(user_id,type,amount,transaction_date,account_id,category_id) values ($1,$2,$3,$4,$5,$6)',[owner,'income',5,'2026-11-15',accountA,childCategory]);
 await reject('insert into public.transactions(user_id,type,amount,transaction_date,from_account_id,to_account_id) values ($1,$2,$3,$4,$5,$6)',[owner,'transfer',3,'2026-11-15',accountA,accountA]);
 await reject('insert into public.transactions(user_id,type,amount,transaction_date,account_id,category_id) values ($1,$2,$3,$4,$5,$6)',[owner,'expense',0,'2026-11-15',accountA,childCategory]);
 await reject('insert into public.budgets(user_id,category_id,month_start,amount) values ($1,$2,$3,$4)',[owner,incomeCategory,'2026-12-01',100]);
 await reject('insert into public.budgets(user_id,category_id,month_start,amount) values ($1,$2,$3,$4)',[owner,childCategory,'2026-12-02',100]);
 await reject('delete from public.projects where id=$1',[project]);
 await reject('delete from public.accounts where id=$1',[accountA]);
 await query('update public.transactions set amount=25 where id=$1',[expense]);
 assert.equal((await one('select * from public.project_spending() where project_id=$1',[project])).spent,'25.00','editing expense updates project spending');
 assert.equal((await one('select * from public.budget_month_totals($1)',['2026-11-01'])).spent,'25.00');
 await query('delete from public.transactions where id=$1',[expense]);
 assert.equal((await one('select * from public.project_spending() where project_id=$1',[project])).spent,'0','deleting expense updates project spending');
 assert.equal((await one('select * from public.account_balances() where account_id=$1',[accountA])).balance,'170.00');
 await query('insert into public.transactions(user_id,type,amount,transaction_date,account_id,category_id) values ($1,$2,$3,$4,$5,$6)',[owner,'income',1,'2026-10-31',accountA,incomeCategory]);
 assert.equal((await one('select * from public.account_balances() where account_id=$1',[accountA])).balance,'171.00','opening date does not hide older transactions');
 await query('insert into public.transactions(user_id,type,amount,transaction_date,account_id,category_id) values ($1,$2,$3,$4,$5,$6)',[owner,'expense',7,'2026-12-01',accountA,childCategory]);
 assert.equal((await one('select * from public.period_totals($1,$2)',['2026-11-01','2026-12-01'])).expense,'0','period end is exclusive');
 assert.equal((await one('select * from public.period_totals($1,$2)',['2026-12-01','2027-01-01'])).expense,'7.00');
 const ownerTask=(await one('insert into public.tasks(user_id,title) values ($1,$2) returning id',[owner,'Owner task'])).id;
 const secondTask=(await one('insert into public.tasks(user_id,title) values ($1,$2) returning id',[owner,'Second task'])).id;
 await claim(outsider);await query('select public.initialize_owner()');
 assert.equal((await one('select count(*)::int as n from public.accounts')).n,0,'RLS hides owner accounts');
 assert.equal((await one('select count(*)::int as n from public.projects')).n,0,'RLS hides owner projects');
 await reject('insert into public.accounts(user_id,name,account_type) values ($1,$2,$3)',[owner,'Stolen','cash']);
 const otherAccount=(await one('insert into public.accounts(user_id,name,account_type) values ($1,$2,$3) returning id',[outsider,'Other cash','cash'])).id;
 const otherTask=(await one('insert into public.tasks(user_id,title) values ($1,$2) returning id',[outsider,'Other task'])).id;
 await claim(owner);
 await reject('insert into public.transactions(user_id,type,amount,transaction_date,account_id,category_id) values ($1,$2,$3,$4,$5,$6)',[owner,'expense',5,'2026-11-20',otherAccount,childCategory]);
 await reject('select public.reorder_tasks($1::jsonb)',[JSON.stringify([{id:otherTask,status:'done',position:0}])]);
 await query('select public.reorder_tasks($1::jsonb)',[JSON.stringify([{id:ownerTask,status:'done',position:1},{id:secondTask,status:'todo',position:0}])]);
 assert.ok((await one('select completed_at from public.tasks where id=$1',[ownerTask])).completed_at,'done status sets completed_at');
 assert.equal((await one('select position from public.tasks where id=$1',[secondTask])).position,0,'board order persists');
 await query('update public.tasks set status=$1 where id=$2',['todo',ownerTask]);
 assert.equal((await one('select completed_at from public.tasks where id=$1',[ownerTask])).completed_at,null,'reopening clears completion time');

 // --- Database engine metadata, tags, custom properties, atomic bulk ops, media & RLS ---
 const ownerProp=(await one('insert into public.database_properties(user_id,database_key,property_key,property_name,property_type,position,is_system_property) values ($1,$2,$3,$4,$5,$6,false) returning id',[owner,'tasks','custom_effort','Nỗ lực','text',10])).id;
 const ownerSelectProp=(await one('insert into public.database_properties(user_id,database_key,property_key,property_name,property_type,position,is_system_property) values ($1,$2,$3,$4,$5,$6,false) returning id',[owner,'tasks','custom_stage','Giai đoạn','status',11])).id;
 const ownerStatusOpt=(await one('insert into public.database_property_options(user_id,property_id,label,color,position,status_group) values ($1,$2,$3,$4,$5,$6) returning id',[owner,ownerSelectProp,'Đang thiết kế','#2563EB',0,'in_progress'])).id;
 const ownerView=(await one('insert into public.database_views(user_id,database_key,view_name,view_type) values ($1,$2,$3,$4) returning id',[owner,'tasks','Bảng tùy chỉnh','table'])).id;
 const ownerTag=(await one('insert into public.tag_options(user_id,name,color) values ($1,$2,$3) returning id',[owner,'Quan trọng','#DC2626'])).id;
 await query('insert into public.task_tags(user_id,record_id,tag_id) values ($1,$2,$3)',[owner,ownerTask,ownerTag]);
 const ownerPage=(await one('insert into public.pages(user_id,title,content) values ($1,$2,$3::jsonb) returning id',[owner,'Ghi chú riêng',JSON.stringify([{type:'paragraph'}])])).id;
 await query('insert into public.record_documents(user_id,database_key,record_id,content) values ($1,$2,$3,$4::jsonb)',[owner,'tasks',ownerTask,JSON.stringify([{type:'paragraph'}])]);
 const ownerMedia=(await one('insert into public.media_assets(user_id,filename,mime_type,size_bytes,data_base64) values ($1,$2,$3,$4,$5) returning id',[owner,'sample.png','image/png',4,'AAAA'])).id;

 // Custom property validation & type conversion
 await query('select public.set_custom_property($1,$2,$3,$4::jsonb)',['tasks',ownerTask,'custom_effort',JSON.stringify('42')]);
 await reject('select public.set_custom_property($1,$2,$3,$4::jsonb)',['tasks',ownerTask,'custom_unknown',JSON.stringify('x')]);
 await reject('select public.set_custom_property($1,$2,$3,$4::jsonb)',['tasks',ownerTask,'custom_effort',JSON.stringify(123)]);
 await query('select public.convert_custom_property_type($1,$2,$3,$4,$5,$6::jsonb)',[ownerProp,'number','Số giờ',true,10,'{}']);
 assert.equal((await one('select custom_properties->>$1 as v from public.tasks where id=$2',['custom_effort',ownerTask])).v,'42','compatible text->number converts cleanly');
 await query('select public.convert_custom_property_type($1,$2,$3,$4,$5,$6::jsonb)',[ownerProp,'text','Nỗ lực',true,10,'{}']);
 await query('select public.set_custom_property($1,$2,$3,$4::jsonb)',['tasks',ownerTask,'custom_effort',JSON.stringify('not-a-number')]);
 await reject('select public.convert_custom_property_type($1,$2,$3,$4,$5,$6::jsonb)',[ownerProp,'number','Số giờ',true,10,'{}']);
 assert.equal((await one('select property_type from public.database_properties where id=$1',[ownerProp])).property_type,'text','failed conversion rolls back cleanly');

 // Atomic bulk delete rolls back entirely if any row hits FK constraint
 const tempProject=(await one('insert into public.projects(user_id,name) values ($1,$2) returning id',[owner,'Deletable Project'])).id;
 await query('insert into public.transactions(user_id,type,amount,transaction_date,account_id,category_id,project_id) values ($1,$2,$3,$4,$5,$6,$7)',[owner,'expense',10,'2026-11-20',accountA,childCategory,project]);
 await reject('select public.bulk_delete_records($1,$2::jsonb)',['projects',JSON.stringify([tempProject,project])]);
 assert.equal((await one('select count(*)::int as n from public.projects where id=$1',[tempProject])).n,1,'atomic bulk delete rolls back tempProject when project fails FK');
 await query('select public.bulk_delete_records($1,$2::jsonb)',['projects',JSON.stringify([tempProject])]);
 assert.equal((await one('select count(*)::int as n from public.projects where id=$1',[tempProject])).n,0,'valid bulk delete removes requested row');

 // Atomic bulk update rolls back entirely if any row violates constraint (e.g. due_date < start_date)
 await query('update public.tasks set start_date=$1,due_date=$2 where id=$3',['2026-11-25','2026-11-30',ownerTask]);
 await query('update public.tasks set start_date=$1,due_date=$2 where id=$3',['2026-11-01','2026-11-20',secondTask]);
 await query('insert into public.database_properties(user_id,database_key,property_key,property_name,property_type,position,is_system_property) values ($1,$2,$3,$4,$5,$6,true) on conflict do nothing',[owner,'tasks','due_date','Hạn chót','date',5]);
 await reject('select public.bulk_update_records($1,$2::jsonb,$3,$4::jsonb)',['tasks',JSON.stringify([secondTask,ownerTask]),'due_date',JSON.stringify('2026-11-10')]);
 assert.equal((await one('select due_date::text as d from public.tasks where id=$1',[secondTask])).d,'2026-11-20','atomic bulk update rolls back secondTask when ownerTask violates due_date >= start_date');
 await query('select public.bulk_update_records($1,$2::jsonb,$3,$4::jsonb)',['tasks',JSON.stringify([secondTask,ownerTask]),'due_date',JSON.stringify('2026-12-05')]);
 assert.equal((await one('select due_date::text as d from public.tasks where id=$1',[secondTask])).d,'2026-12-05','valid atomic bulk update updates all rows');

 // Deleting a tag does NOT delete its parent record
 await query('delete from public.tag_options where id=$1',[ownerTag]);
 assert.equal((await one('select count(*)::int as n from public.tasks where id=$1',[ownerTask])).n,1,'deleting a tag preserves parent record');
 assert.equal((await one('select count(*)::int as n from public.task_tags where record_id=$1',[ownerTask])).n,0,'deleting a tag cleans up join table');

 // Deleting a record cleans up record_documents
 await query('delete from public.tasks where id=$1',[ownerTask]);
 assert.equal((await one('select count(*)::int as n from public.record_documents where record_id=$1',[ownerTask])).n,0,'deleting record cleans up record_documents');

 // Cross-user RLS for all new metadata, tags, pages, documents, and media_assets
 const outsiderTag=(await (async()=>{await claim(outsider); return (await one('insert into public.tag_options(user_id,name,color) values ($1,$2,$3) returning id',[outsider,'Outsider tag','#78716C'])).id;})());
 assert.equal((await one('select count(*)::int as n from public.database_properties where id=$1',[ownerProp])).n,0,'RLS hides owner properties');
 assert.equal((await one('select count(*)::int as n from public.database_property_options where id=$1',[ownerStatusOpt])).n,0,'RLS hides owner property options');
 assert.equal((await one('select count(*)::int as n from public.database_views where id=$1',[ownerView])).n,0,'RLS hides owner views');
 assert.equal((await one('select count(*)::int as n from public.pages where id=$1',[ownerPage])).n,0,'RLS hides owner pages');
 assert.equal((await one('select count(*)::int as n from public.media_assets where id=$1',[ownerMedia])).n,0,'RLS hides owner media');
 await reject('insert into public.record_documents(user_id,database_key,record_id,content) values ($1,$2,$3,$4::jsonb)',[outsider,'tasks',secondTask,'[]']);
 await claim(owner);
 await reject('insert into public.task_tags(user_id,record_id,tag_id) values ($1,$2,$3)',[owner,secondTask,outsiderTag]);

 await db.exec('set role anon;');await claim('');
 assert.equal((await one('select count(*)::int as n from public.transactions')).n,0,'unauthenticated role sees no private transactions');
 assert.equal((await one('select count(*)::int as n from public.pages')).n,0,'unauthenticated role sees no private pages');
 assert.equal((await one('select count(*)::int as n from public.media_assets')).n,0,'unauthenticated role sees no private media');
 process.stdout.write('Database integration: all assertions passed\n');
} finally { await db.close(); }

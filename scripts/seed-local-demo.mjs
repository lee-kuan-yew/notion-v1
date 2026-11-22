import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = process.cwd();
const dataDir = join(root, '.local-pg');
if (existsSync(join(root, '.next', 'dev', 'lock'))) {
  console.error('Stop pnpm dev before seeding the local database.');
  process.exit(1);
}
if (!existsSync(dataDir)) {
  console.error('Local database not found. Run pnpm dev and open /app once, then stop the server.');
  process.exit(1);
}
const owner = '11111111-1111-4111-8111-111111111111';
const uuid = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const part = type => Number(parts.find(item => item.type === type)?.value);
const year = part('year'), month = part('month'), todayDay = part('day');
const iso = date => date.toISOString().slice(0, 10);
const date = (offset, day) => iso(new Date(Date.UTC(year, month - 1 + offset, day)));
const relative = days => iso(new Date(Date.UTC(year, month - 1, todayDay + days)));
const currentDay = day => Math.min(day, todayDay);
const monthKey = offset => { const d = new Date(Date.UTC(year, month - 1 + offset, 1)); return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; };
const txId = (offset, seq) => uuid(600000000 + monthKey(offset) * 100 + seq);
const budgetId = (offset, seq) => uuid(700000000 + monthKey(offset) * 100 + seq);
const db = await PGlite.create(dataDir);
const query = (sql, params = []) => db.query(sql, params);
const one = async (sql, params = []) => (await query(sql, params)).rows[0];
const ident = value => { if (!/^[a-z_]+$/.test(value)) throw new Error('Invalid identifier'); return value; };
async function insert(table, id, fields) {
  const record = { id: uuid(id), user_id: owner, ...fields };
  const entries = Object.entries(record);
  await query(`insert into public.${ident(table)} (${entries.map(([key]) => ident(key)).join(',')}) values (${entries.map((_, index) => `$${index + 1}`).join(',')}) on conflict (id) do nothing`, entries.map(([, value]) => value));
  return record.id;
}
async function category(name, kind, number, parentId = null, icon = 'Tags', color = '#78716C') {
  const existing = await one('select id from public.categories where user_id=$1 and name=$2 and kind=$3 and parent_id is not distinct from $4', [owner, name, kind, parentId]);
  if (existing) return existing.id;
  await insert('categories', number, { name, kind, parent_id: parentId, icon, color });
  return (await one('select id from public.categories where user_id=$1 and name=$2 and kind=$3 and parent_id is not distinct from $4', [owner, name, kind, parentId])).id;
}
async function transaction(offset, seq, fields) {
  const day = offset === 0 ? currentDay(fields.day) : fields.day;
  const { day: ignored, ...payload } = fields;
  void ignored;
  const record = { id: txId(offset, seq), user_id: owner, transaction_date: date(offset, day), ...payload };
  const entries = Object.entries(record);
  await query(`insert into public.transactions (${entries.map(([key]) => ident(key)).join(',')}) values (${entries.map((_, index) => `$${index + 1}`).join(',')}) on conflict (id) do nothing`, entries.map(([, value]) => value));
}
async function budget(offset, seq, categoryId, amount) {
  const record = { id: budgetId(offset, seq), user_id: owner, category_id: categoryId, month_start: date(offset, 1), amount };
  const entries = Object.entries(record);
  await query(`insert into public.budgets (${entries.map(([key]) => ident(key)).join(',')}) values (${entries.map((_, index) => `$${index + 1}`).join(',')}) on conflict (id) do nothing`, entries.map(([, value]) => value));
}
try {
  const schema = await one("select to_regclass('public.profiles')::text as name");
  if (!schema?.name) throw new Error('Local migrations not found. Start the app once before seeding.');
  await db.exec('set role authenticated');
  await query('select set_config($1,$2,false)', ['request.jwt.claim.sub', owner]);
  await db.exec('begin');
  await query('select public.initialize_owner()');

  const salary = await category('Lương', 'income', 101, null, 'BriefcaseBusiness', '#16A34A');
  const otherIncome = await category('Thu nhập khác', 'income', 102, null, 'Plus', '#16A34A');
  const food = await category('Ăn uống', 'expense', 103, null, 'Utensils', '#D97706');
  const transport = await category('Di chuyển', 'expense', 104, null, 'Car');
  const housing = await category('Nhà ở', 'expense', 105, null, 'House');
  const shopping = await category('Mua sắm', 'expense', 106, null, 'ShoppingBag');
  const projectCategory = await category('Dự án', 'expense', 107, null, 'FolderKanban');
  const coffee = await category('Cà phê', 'expense', 108, food, 'Coffee', '#D97706');
  const equipment = await category('Thiết bị', 'expense', 109, projectCategory, 'ShoppingBag');
  const advertising = await category('Quảng cáo', 'expense', 110, projectCategory, 'Tags');
  const travel = await category('Du lịch', 'expense', 111, null, 'Plane');
  const learning = await category('Học tập', 'expense', 112, null, 'BookOpen');
  const health = await category('Sức khỏe', 'expense', 113, null, 'HeartPulse');
  const bills = await category('Hóa đơn', 'expense', 114, null, 'Wallet');
  const leisure = await category('Giải trí', 'expense', 115, null, 'Gift');

  const bank = await insert('accounts', 201, { name: 'Ngân hàng chính', account_type: 'bank', opening_balance: 12000000, opening_balance_date: date(-6, 1), color: '#2563EB' });
  const wallet = await insert('accounts', 202, { name: 'Ví điện tử', account_type: 'e_wallet', opening_balance: 1000000, opening_balance_date: date(-6, 1), color: '#D97706' });
  const cash = await insert('accounts', 203, { name: 'Tiền mặt', account_type: 'cash', opening_balance: 2000000, opening_balance_date: date(-6, 1), color: '#16A34A' });
  const savings = await insert('accounts', 204, { name: 'Tiết kiệm', account_type: 'savings', opening_balance: 70000000, opening_balance_date: date(-6, 1), color: '#7C3AED' });

  const zeruka = await insert('projects', 301, { name: 'Zeruka Website', description: 'Thiết kế và ra mắt website sản phẩm.', status: 'active', priority: 'high', start_date: date(-2, 1), due_date: relative(24), budget_amount: 30000000, color: '#2563EB' });
  const marketing = await insert('projects', 302, { name: 'Chiến dịch Marketing Q4', description: 'Nội dung, quảng cáo và landing page cho quý 4.', status: 'active', priority: 'urgent', start_date: date(-1, 1), due_date: relative(9), budget_amount: 12000000, color: '#D97706' });
  const condao = await insert('projects', 303, { name: 'Du lịch Côn Đảo', description: 'Lịch trình, vé, nơi ở và ngân sách chuyến đi.', status: 'planning', priority: 'medium', start_date: date(0, 10), due_date: relative(28), budget_amount: 8000000, color: '#0891B2' });
  const english = await insert('projects', 304, { name: 'Học tiếng Anh', description: 'Hoàn thành khóa học và luyện giao tiếp.', status: 'on_hold', priority: 'low', start_date: date(-2, 5), due_date: relative(50), budget_amount: 3000000, color: '#7C3AED' });
  const portfolio = await insert('projects', 305, { name: 'Thiết kế portfolio', description: 'Portfolio cá nhân đã xuất bản.', status: 'completed', priority: 'medium', start_date: date(-3, 1), due_date: date(-1, 10), budget_amount: 5000000, color: '#16A34A' });

  const salaryAmounts = [45000000, 43000000, 42000000, 41000000, 40000000, 39000000];
  const shoppingAmounts = [2800000, 1800000, 2200000, 1400000, 3100000, 1500000];
  const foodAmounts = [2800000, 2900000, 3100000, 2700000, 3000000, 2800000];
  for (let offset = 5; offset >= 0; offset--) {
    await transaction(-offset, 1, { type: 'income', amount: salaryAmounts[offset], day: 2, account_id: bank, category_id: salary, payee: 'Công ty', description: 'Lương tháng' });
    await transaction(-offset, 2, { type: 'income', amount: offset === 0 ? 300000 : 200000, day: 3, account_id: savings, category_id: otherIncome, description: 'Lãi tiết kiệm' });
    await transaction(-offset, 3, { type: 'expense', amount: 7500000, day: 5, account_id: bank, category_id: housing, payee: 'Chủ nhà', description: 'Tiền nhà' });
    await transaction(-offset, 4, { type: 'expense', amount: 1100000, day: 6, account_id: bank, category_id: bills, description: 'Điện, nước và internet' });
    await transaction(-offset, 5, { type: 'expense', amount: foodAmounts[offset], day: 8, account_id: wallet, category_id: food, description: 'Ăn uống trong tháng' });
    await transaction(-offset, 6, { type: 'expense', amount: offset === 0 ? 1200000 : 1100000, day: 10, account_id: wallet, category_id: transport, description: 'Di chuyển và xăng xe' });
    await transaction(-offset, 7, { type: 'transfer', amount: 6000000, day: 7, from_account_id: bank, to_account_id: wallet, description: 'Nạp ví điện tử' });
    await transaction(-offset, 8, { type: 'transfer', amount: 1000000, day: 9, from_account_id: bank, to_account_id: cash, description: 'Rút tiền mặt' });
    await transaction(-offset, 9, { type: 'transfer', amount: offset === 0 ? 10000000 : 5000000, day: 11, from_account_id: bank, to_account_id: savings, description: 'Chuyển tiết kiệm' });
    await transaction(-offset, 10, { type: 'expense', amount: offset === 0 ? 450000 : 400000, day: 12, account_id: cash, category_id: coffee, description: 'Cà phê và gặp gỡ' });
    await transaction(-offset, 11, { type: 'expense', amount: shoppingAmounts[offset], day: 15, account_id: bank, category_id: shopping, description: 'Mua sắm cá nhân' });
    await transaction(-offset, 12, { type: 'expense', amount: 500000, day: 19, account_id: bank, category_id: leisure, description: 'Giải trí cuối tuần' });
  }
  await transaction(-1, 20, { type: 'income', amount: 8000000, day: 18, account_id: bank, category_id: otherIncome, payee: 'Khách hàng', description: 'Freelance tháng trước' });
  await transaction(0, 20, { type: 'income', amount: 5000000, day: 16, account_id: bank, category_id: otherIncome, payee: 'Khách hàng', description: 'Dự án freelance' });
  await transaction(0, 21, { type: 'expense', amount: 600000, day: 17, account_id: bank, category_id: health, description: 'Khám sức khỏe' });
  await transaction(-2, 30, { type: 'expense', amount: 2000000, day: 12, account_id: bank, category_id: equipment, project_id: zeruka, description: 'Thiết bị cho Zeruka' });
  await transaction(-1, 30, { type: 'expense', amount: 1300000, day: 13, account_id: bank, category_id: projectCategory, project_id: zeruka, description: 'Hosting và thiết kế Zeruka' });
  await transaction(0, 30, { type: 'expense', amount: 2400000, day: 14, account_id: bank, category_id: equipment, project_id: zeruka, description: 'Thiết bị website Zeruka' });
  await transaction(0, 31, { type: 'expense', amount: 1100000, day: 20, account_id: bank, category_id: projectCategory, project_id: zeruka, description: 'Dịch vụ triển khai Zeruka' });
  await transaction(-1, 32, { type: 'expense', amount: 1600000, day: 15, account_id: bank, category_id: advertising, project_id: marketing, description: 'Quảng cáo tháng trước' });
  await transaction(0, 32, { type: 'expense', amount: 1800000, day: 18, account_id: bank, category_id: advertising, project_id: marketing, description: 'Chiến dịch quảng cáo' });
  await transaction(0, 33, { type: 'expense', amount: 900000, day: 21, account_id: bank, category_id: projectCategory, project_id: marketing, description: 'Thiết kế landing page' });
  await transaction(0, 34, { type: 'expense', amount: 1200000, day: 20, account_id: bank, category_id: travel, project_id: condao, description: 'Đặt cọc chuyến Côn Đảo' });
  await transaction(0, 35, { type: 'expense', amount: 800000, day: 21, account_id: bank, category_id: learning, project_id: english, description: 'Khóa học tiếng Anh' });
  await transaction(-2, 36, { type: 'expense', amount: 3500000, day: 17, account_id: bank, category_id: projectCategory, project_id: portfolio, description: 'Thiết kế portfolio' });

  for (const offset of [0, -1]) {
    const amounts = [4500000, 8000000, 1500000, 2000000, 7000000, 1000000, 2000000, 1500000, 1500000];
    const ids = [food, housing, transport, shopping, projectCategory, health, travel, learning, bills];
    for (let i = 0; i < ids.length; i++) await budget(offset, i + 1, ids[i], amounts[i]);
  }

  const tasks = [
    [401, zeruka, 'Hoàn thiện kiến trúc dữ liệu', 'done', 'high', -15, 0],
    [402, zeruka, 'Thiết kế trang chủ', 'done', 'medium', -8, 1],
    [403, zeruka, 'Tích hợp thanh toán', 'done', 'high', -3, 2],
    [404, zeruka, 'Tối ưu mobile', 'in_progress', 'high', -2, 0],
    [405, zeruka, 'Kiểm thử trước ra mắt', 'review', 'medium', 6, 0],
    [406, marketing, 'Lên kế hoạch nội dung', 'done', 'high', -6, 0],
    [407, marketing, 'Duyệt landing page', 'todo', 'urgent', -4, 0],
    [408, marketing, 'Theo dõi hiệu quả quảng cáo', 'in_progress', 'high', 3, 0],
    [409, marketing, 'Báo cáo cuối chiến dịch', 'backlog', 'medium', 9, 0],
    [410, condao, 'Chọn lịch trình', 'done', 'medium', -1, 0],
    [411, condao, 'Đặt vé máy bay', 'todo', 'high', 5, 0],
    [412, condao, 'Chọn khách sạn', 'backlog', 'medium', 10, 0],
    [413, english, 'Hoàn thành bài học 1', 'done', 'low', -20, 0],
    [414, english, 'Luyện nói 30 phút', 'todo', 'medium', 7, 0],
    [415, english, 'Kiểm tra cuối khóa', 'backlog', 'medium', 45, 0],
    [416, portfolio, 'Thiết kế layout', 'done', 'medium', -45, 0],
    [417, portfolio, 'Viết nội dung', 'done', 'medium', -42, 1],
    [418, portfolio, 'Xuất bản', 'done', 'high', -40, 2],
    [419, null, 'Gia hạn bảo hiểm', 'todo', 'urgent', -3, 0],
    [420, null, 'Rà soát kế hoạch tháng tới', 'todo', 'medium', 4, 1],
  ];
  for (const [id, project_id, title, status, priority, dueOffset, position] of tasks) {
    await insert('tasks', id, { project_id, title, status, priority, due_date: relative(dueOffset), position });
  }
  const milestones = [
    [501, zeruka, 'Bản beta', 6, 'in_progress', 0],
    [502, zeruka, 'Ra mắt website', 24, 'pending', 1],
    [503, marketing, 'Chốt nội dung', 4, 'in_progress', 0],
    [504, marketing, 'Tổng kết Q4', 9, 'pending', 1],
    [505, condao, 'Đặt vé và khách sạn', 5, 'pending', 0],
    [506, condao, 'Khởi hành', 28, 'pending', 1],
    [507, portfolio, 'Xuất bản portfolio', -40, 'completed', 0],
  ];
  for (const [id, project_id, title, dueOffset, status, position] of milestones) {
    await insert('milestones', id, { project_id, title, due_date: relative(dueOffset), status, position });
  }
  await db.exec('commit');
  const period = await one('select * from public.period_totals($1,$2)', [date(0, 1), date(1, 1)]);
  const projectSpending = (await query('select * from public.project_spending()')).rows;
  const balances = (await query('select * from public.account_balances()')).rows;
  console.log(`Local demo ready: ${await one('select count(*)::int as n from public.transactions').then(row => row.n)} transactions, ${balances.length} accounts, ${projectSpending.length} projects.`);
  console.log(`This month: income ${period.income} VND, expense ${period.expense} VND.`);
  console.log('Run pnpm dev and open http://127.0.0.1:3000/app');
} catch (error) {
  await db.exec('rollback').catch(() => {});
  console.error('Local demo seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.close();
}

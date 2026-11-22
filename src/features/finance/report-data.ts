import type { WorkspaceData } from '@/features/workspace/queries';
export function reportData(d:WorkspaceData) {
 const categoryNames=new Map(d.categories.map(c=>[c.id,c.name]));
 const projectNames=new Map(d.projects.map(p=>[p.id,p.name]));
 const monthly=d.monthly.map(m=>({name:m.month_start.slice(0,7),income:Number(m.income),expense:Number(m.expense),cashflow:Number(m.income)-Number(m.expense)}));
 const categories=d.expenseCategories.map(c=>({name:categoryNames.get(c.category_id)??'Khác',value:Number(c.spent)}));
 const actuals=new Map(d.actuals.map(a=>[a.budget_id,a.spent]));
 const budgets=d.budgets.filter(b=>b.month_start===d.month).map(b=>({name:categoryNames.get(b.category_id)??'Khác',budget:Number(b.amount),actual:Number(actuals.get(b.id)??0)}));
 const projects=d.periodSpending.filter(p=>Number(p.spent)>0).map(p=>({name:projectNames.get(p.project_id)??'Dự án',value:Number(p.spent)}));
 return {monthly,categories,budgets,projects};
}

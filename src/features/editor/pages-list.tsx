'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus,FileText } from 'lucide-react';
import { createPage } from '@/features/database/actions';
import type { Page } from '@/types/database';
export function PagesList({pages}:{pages:Page[]}) {const router=useRouter();return <><div className="mb-6 flex items-center justify-between"><div><h1 className="text-3xl font-semibold">Trang</h1><p className="mt-1 text-muted">Ghi chú và tài liệu bằng các khối nội dung.</p></div><button className="btn btn-primary" onClick={async()=>{const result=await createPage();if(result.ok)router.push(`/app/pages/${result.value}`);else toast.error(result.error)}}><Plus size={16}/> Trang mới</button></div><div className="divide-y divide-line rounded-lg border border-line bg-surface">{pages.map(page=><Link key={page.id} href={`/app/pages/${page.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-soft"><FileText size={17} className="text-muted"/><span className="flex-1 font-medium">{page.title}</span><span className="text-xs text-muted">{new Date(page.updated_at).toLocaleDateString('vi-VN')}</span></Link>)}{pages.length===0&&<p className="p-8 text-center text-muted">Chưa có trang nào. Tạo trang đầu tiên để bắt đầu.</p>}</div></>}

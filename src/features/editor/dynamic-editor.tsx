'use client';
import dynamic from 'next/dynamic';
export const DynamicEditor=dynamic(()=>import('./block-editor').then(module=>module.BlockEditor),{ssr:false,loading:()=> <div className="card p-8 text-muted">Đang mở trình soạn thảo…</div>});

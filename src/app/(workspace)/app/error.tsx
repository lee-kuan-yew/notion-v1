'use client';
export default function ErrorPage({error,reset}:{error:Error;reset:()=>void}) {return <div className="card p-8"><h1 className="text-xl font-semibold">Không thể tải dữ liệu</h1><p className="mt-2 text-muted">{error.message}</p><button className="btn mt-5" onClick={reset}>Thử lại</button></div>}

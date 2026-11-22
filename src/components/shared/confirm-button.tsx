'use client';
export function ConfirmButton({children,message='Xóa mục này?'}:{children:React.ReactNode;message?:string}) { return <button type="submit" className="btn btn-danger !px-2 !py-1 text-xs" onClick={event=>{if(!window.confirm(message)) event.preventDefault();}}>{children}</button>; }

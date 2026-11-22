'use client';
import { useEffect } from 'react';
import { toast } from 'sonner';
export function StatusToast({error,saved}:{error?:string;saved?:string}) {
 useEffect(()=>{if(error) toast.error(error);else if(saved) toast.success('Đã lưu thay đổi.');},[error,saved]);
 return null;
}

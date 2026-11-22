'use client';
import Link from 'next/link';
import { useState } from 'react';
import { DndContext, closestCorners, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import type { Task,TaskStatus } from '@/types/database';
import { reorderTasks } from '@/features/workspace/actions';
import { dateVN,label } from '@/components/shared/format';
import { PriorityBadge } from '@/components/shared/priority';
const columns:Exclude<TaskStatus,'cancelled'>[]=['backlog','todo','in_progress','review','done'];
function Card({task}:{task:Task}) {
 const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:task.id});
 return <div ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition,opacity:isDragging?.5:1}} className="card mb-2 p-3 shadow-sm"><div className="flex items-start gap-2"><button {...attributes} {...listeners} className="cursor-grab text-muted" aria-label={`Kéo ${task.title}`}>⋮⋮</button><div className="min-w-0 flex-1"><p className="font-medium">{task.title}</p><div className="meta mt-1.5 flex flex-wrap items-center gap-1.5"><span>{dateVN(task.due_date)}</span><PriorityBadge priority={task.priority} size="xs" /></div></div><Link className="text-xs text-muted underline" href={`/app/tasks?edit=${task.id}`}>Sửa</Link></div></div>;
}
function Column({status,tasks}:{status:Exclude<TaskStatus,'cancelled'>;tasks:Task[]}) {
 const {setNodeRef,isOver}=useDroppable({id:`col:${status}`});
 return <section ref={setNodeRef} className={`w-64 shrink-0 rounded-xl border border-line bg-soft/60 p-2 ${isOver?'ring-2 ring-stone-400':''}`}><div className="flex items-center justify-between px-2 py-2"><h2 className="font-semibold">{label(status)}</h2><span className="badge">{tasks.length}</span></div><SortableContext items={tasks.map(t=>t.id)} strategy={verticalListSortingStrategy}>{tasks.map(t=><Card key={t.id} task={t}/>)}</SortableContext>{tasks.length===0&&<p className="px-2 py-6 text-center text-xs text-muted">Kéo công việc vào đây</p>}</section>;
}
export function TaskBoard({tasks}:{tasks:Task[]}) {
 const [items,setItems]=useState(tasks.filter(t=>t.status!=='cancelled'));
 const [busy,setBusy]=useState(false);
 async function onDragEnd(event:DragEndEvent) {
  const activeId=String(event.active.id),overId=event.over?String(event.over.id):'';
  const active=items.find(t=>t.id===activeId); if(!active||!overId||activeId===overId||busy) return;
  const overTask=items.find(t=>t.id===overId);
  const targetStatus=(overId.startsWith('col:')?overId.slice(4):overTask?.status) as Exclude<TaskStatus,'cancelled'>|undefined;
  if(!targetStatus||!columns.includes(targetStatus)) return;
  const target=items.filter(t=>t.id!==activeId&&t.status===targetStatus).sort((a,b)=>a.position-b.position);
  const index=overTask?Math.max(0,target.findIndex(t=>t.id===overTask.id)):target.length;
  target.splice(index,0,{...active,status:targetStatus});
  const order=new Map<string,{status:Exclude<TaskStatus,'cancelled'>;position:number}>();
  for(const status of columns) {
   const list=status===targetStatus?target:items.filter(t=>t.id!==activeId&&t.status===status).sort((a,b)=>a.position-b.position);
   list.forEach((task,position)=>order.set(task.id,{status,position}));
  }
  const next=items.map(t=>({...t,...order.get(t.id)})); const previous=items; setItems(next); setBusy(true);
  try {await reorderTasks([...order].map(([id,value])=>({id,...value})));} catch(error) {setItems(previous);toast.error(error instanceof Error?error.message:'Không thể sắp xếp công việc');} finally {setBusy(false);}
 }
 return <DndContext collisionDetection={closestCorners} onDragEnd={onDragEnd}><div className="flex gap-3 overflow-x-auto pb-3">{columns.map(status=><Column key={status} status={status} tasks={items.filter(t=>t.status===status).sort((a,b)=>a.position-b.position)}/>)}</div></DndContext>;
}

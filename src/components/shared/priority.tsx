'use client';

import { useState } from 'react';
import type { Priority } from '@/types/database';
import { label } from '@/components/shared/format';
import { cn } from '@/lib/utils';

export const PRIORITY_ORDER: Priority[] = ['low', 'medium', 'high', 'urgent'];

export const PRIORITY_STYLES: Record<
  Priority,
  {
    dot: string;
    badge: string;
    buttonIdle: string;
    buttonActive: string;
  }
> = {
  low: {
    dot: 'bg-stone-500 dark:bg-stone-400',
    badge:
      'border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800/80 dark:text-stone-300',
    buttonIdle:
      'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300 dark:hover:bg-stone-800',
    buttonActive:
      'border-stone-500 bg-stone-600 text-white shadow-xs dark:border-stone-400 dark:bg-stone-500 dark:text-white',
  },
  medium: {
    dot: 'bg-cyan-600 dark:bg-cyan-400',
    badge:
      'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800/80 dark:bg-cyan-950/60 dark:text-cyan-300',
    buttonIdle:
      'border-cyan-200 bg-cyan-50/60 text-cyan-700 hover:bg-cyan-100/80 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300 dark:hover:bg-cyan-950/60',
    buttonActive:
      'border-cyan-600 bg-cyan-600 text-white shadow-xs dark:border-cyan-500 dark:bg-cyan-600 dark:text-white',
  },
  high: {
    dot: 'bg-orange-500 dark:bg-orange-400',
    badge:
      'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/80 dark:bg-orange-950/60 dark:text-orange-300',
    buttonIdle:
      'border-orange-200 bg-orange-50/60 text-orange-700 hover:bg-orange-100/80 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/60',
    buttonActive:
      'border-orange-600 bg-orange-600 text-white shadow-xs dark:border-orange-500 dark:bg-orange-600 dark:text-white',
  },
  urgent: {
    dot: 'bg-red-600 dark:bg-red-400',
    badge:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-800/80 dark:bg-red-950/60 dark:text-red-300',
    buttonIdle:
      'border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100/80 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/60',
    buttonActive:
      'border-red-600 bg-red-600 text-white shadow-xs dark:border-red-500 dark:bg-red-600 dark:text-white',
  },
};

export function PriorityBadge({
  priority,
  size = 'sm',
  className,
}: {
  priority: Priority;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium leading-none',
        size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        style.badge,
        className
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', style.dot)} aria-hidden="true" />
      <span>{label(priority)}</span>
    </span>
  );
}

export function PriorityPicker({
  name = 'priority',
  id,
  defaultValue = 'medium',
  value,
  onChange,
}: {
  name?: string;
  id?: string;
  defaultValue?: Priority;
  value?: Priority;
  onChange?: (next: Priority) => void;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<Priority>(defaultValue);
  const current = isControlled ? value : internal;

  function select(next: Priority) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  return (
    <div id={id} role="radiogroup" aria-label="Mức độ ưu tiên" className="flex flex-wrap gap-1.5">
      {name && <input type="hidden" name={name} value={current} />}
      {PRIORITY_ORDER.map(level => {
        const active = current === level;
        const style = PRIORITY_STYLES[level];
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => select(level)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
              active ? style.buttonActive : style.buttonIdle
            )}
          >
            <span
              className={cn('size-2 shrink-0 rounded-full', active ? 'bg-white' : style.dot)}
              aria-hidden="true"
            />
            <span>{label(level)}</span>
          </button>
        );
      })}
    </div>
  );
}

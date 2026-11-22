'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectDropdownProps = {
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'md' | 'sm' | 'xs';
  className?: string;
  menuClassName?: string;
  'aria-label'?: string;
};

export function SelectDropdown({
  options,
  value,
  defaultValue = '',
  onChange,
  name,
  id,
  placeholder = 'Chọn...',
  disabled = false,
  required = false,
  size = 'md',
  className,
  menuClassName,
  'aria-label': ariaLabel,
}: SelectDropdownProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  if (!isControlled && prevDefault !== defaultValue) {
    setPrevDefault(defaultValue);
    setInternalValue(defaultValue);
  }
  const currentValue = isControlled ? value : internalValue;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find(opt => opt.value === currentValue),
    [options, currentValue]
  );

  function computeCoords() {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, size === 'xs' ? 132 : 172);
    const left = Math.max(10, Math.min(rect.left, window.innerWidth - width - 10));
    const spaceBelow = window.innerHeight - rect.bottom - 14;
    const spaceAbove = rect.top - 14;
    const estHeight = Math.min(options.length * (size === 'md' ? 42 : 34) + 4, 280);
    if (spaceBelow < Math.min(estHeight, 160) && spaceAbove > spaceBelow) {
      const maxHeight = Math.max(100, Math.min(280, spaceAbove));
      const actualHeight = Math.min(estHeight, maxHeight);
      return { top: Math.max(10, rect.top - actualHeight - 6), left, width, maxHeight };
    }
    const maxHeight = Math.max(120, Math.min(280, spaceBelow));
    return { top: rect.bottom + 6, left, width, maxHeight };
  }

  function openMenu() {
    if (disabled) return;
    const next = computeCoords();
    setCoords(next);
    const idx = options.findIndex(opt => opt.value === currentValue && !opt.disabled);
    setActiveIndex(idx >= 0 ? idx : options.findIndex(opt => !opt.disabled));
    setOpen(true);
  }

  function closeMenu(returnFocus = false) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function selectValue(nextVal: string) {
    if (!isControlled) setInternalValue(nextVal);
    onChange?.(nextVal);
    closeMenu(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeMenu(true);
      }
    }
    function onReposition(event: Event) {
      if (event.type === 'scroll' && menuRef.current?.contains(event.target as Node)) return;
      const next = computeCoords();
      if (next) setCoords(next);
    }
    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length]);

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(curr => {
        for (let i = 1; i <= options.length; i++) {
          const next = (curr + i) % options.length;
          if (!options[next]?.disabled) return next;
        }
        return curr;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(curr => {
        for (let i = 1; i <= options.length; i++) {
          const next = (curr - i + options.length) % options.length;
          if (!options[next]?.disabled) return next;
        }
        return curr;
      });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const active = options[activeIndex];
      if (active && !active.disabled) selectValue(active.value);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = options.findIndex(o => !o.disabled);
      if (first >= 0) setActiveIndex(first);
    } else if (event.key === 'End') {
      event.preventDefault();
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          setActiveIndex(i);
          break;
        }
      }
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  const sizeTrigger =
    size === 'xs'
      ? 'h-7 px-2.5 text-[11px] rounded-lg gap-1.5'
      : size === 'sm'
        ? 'h-8 px-3 text-xs rounded-xl gap-2'
        : 'min-h-[38px] px-3.5 py-2 text-[14px] rounded-xl gap-2.5';

  const sizeOption =
    size === 'xs'
      ? 'px-3 py-1.5 text-xs'
      : size === 'sm'
        ? 'px-3.5 py-2 text-xs'
        : 'px-4 py-2.5 text-[14px]';

  return (
    <div className={cn('relative inline-block w-full min-w-0', className)}>
      {name && <input type="hidden" name={name} value={currentValue} required={required} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={event => {
          event.stopPropagation();
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'dropdown-trigger flex w-full items-center justify-between font-medium text-ink transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-55',
          sizeTrigger
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate text-left', !selectedOption && 'text-muted')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16}
          strokeWidth={2}
          className={cn('shrink-0 text-ink/80 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            data-dropdown-portal="true"
            aria-label={ariaLabel}
            style={{
              top: coords.top,
              left: coords.left,
              minWidth: coords.width,
              maxWidth: 'min(92vw, 360px)',
              maxHeight: coords.maxHeight,
            }}
            className={cn('dropdown-menu fixed z-[70] overflow-y-auto', menuClassName)}
            onClick={event => event.stopPropagation()}
          >
            {options.length === 0 ? (
              <div className={cn('text-muted', sizeOption)}>Không có lựa chọn</div>
            ) : (
              options.map((opt, idx) => {
                const selected = opt.value === currentValue;
                const active = idx === activeIndex;
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={opt.disabled}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectValue(opt.value)}
                    className={cn(
                      'dropdown-item flex w-full items-center justify-between gap-2 text-left transition-colors',
                      sizeOption,
                      active && 'bg-[#eef2f6] dark:bg-soft',
                      selected && 'font-medium',
                      opt.disabled && 'cursor-not-allowed opacity-45'
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selected && <Check size={14} className="shrink-0 text-ink/70" />}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

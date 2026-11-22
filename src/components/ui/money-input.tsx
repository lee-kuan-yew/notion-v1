'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import {
  computeFormattedCaret,
  formatMoneyDraft,
  normalizeMoneyValue,
  sanitizeMoneyDraft,
} from '@/lib/money-input';

export interface MoneyInputProps {
  id?: string;
  name?: string;
  value?: string | number | null;
  defaultValue?: string | number | null;
  onValueChange?: (rawValue: string) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  allowNegative?: boolean;
  showCurrencySuffix?: boolean;
  className?: string;
  wrapperClassName?: string;
  'aria-label'?: string;
}

export function MoneyInput({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  onBlur,
  onKeyDown,
  placeholder = '0',
  required,
  disabled,
  readOnly,
  autoFocus,
  allowNegative = false,
  showCurrencySuffix = true,
  className = '',
  wrapperClassName = '',
  'aria-label': ariaLabel,
}: MoneyInputProps) {
  const isControlled = value !== undefined;
  const [draft, setDraft] = useState<string>(() =>
    normalizeMoneyValue(isControlled ? value : defaultValue, { allowNegative })
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);

  const activeDraft = isControlled
    ? normalizeMoneyValue(draft, { allowNegative }) === normalizeMoneyValue(value, { allowNegative })
      ? draft
      : normalizeMoneyValue(value, { allowNegative })
    : draft;

  const displayValue = formatMoneyDraft(activeDraft);
  const normalizedValue = normalizeMoneyValue(activeDraft, { allowNegative });

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret !== null && inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.setSelectionRange(caret, caret);
    }
    pendingCaretRef.current = null;
  });

  function updateFromRaw(nextRawInput: string, rawBeforeCaret?: string) {
    const nextDraft = sanitizeMoneyDraft(nextRawInput, { allowNegative });
    const nextDisplay = formatMoneyDraft(nextDraft);
    if (rawBeforeCaret !== undefined) {
      pendingCaretRef.current = computeFormattedCaret(rawBeforeCaret, nextDisplay, allowNegative);
    }
    setDraft(nextDraft);
    onValueChange?.(normalizeMoneyValue(nextDraft, { allowNegative }));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const el = event.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (
      start !== null &&
      end !== null &&
      start === end &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      if (event.key === 'Backspace' && start > 0 && displayValue[start - 1] === ',') {
        event.preventDefault();
        const removeIdx = start - 2;
        if (removeIdx >= 0) {
          const nextRaw = displayValue.slice(0, removeIdx) + displayValue.slice(start);
          updateFromRaw(nextRaw, displayValue.slice(0, removeIdx));
        }
        return;
      }
      if (event.key === 'Delete' && start < displayValue.length && displayValue[start] === ',') {
        event.preventDefault();
        const nextRaw = displayValue.slice(0, start) + displayValue.slice(start + 2);
        updateFromRaw(nextRaw, displayValue.slice(0, start));
        return;
      }
    }

    onKeyDown?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const clean = normalizeMoneyValue(activeDraft, { allowNegative });
    if (clean !== activeDraft) {
      setDraft(clean);
      onValueChange?.(clean);
    }
    onBlur?.(event);
  }

  const inputElement = (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={ariaLabel}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      autoFocus={autoFocus}
      value={displayValue}
      onChange={event => {
        const el = event.currentTarget;
        const caret = el.selectionStart ?? el.value.length;
        updateFromRaw(el.value, el.value.slice(0, caret));
      }}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={`input tabular-nums ${showCurrencySuffix ? '!pr-8' : ''} ${className}`.trim()}
    />
  );

  if (!showCurrencySuffix && !name) {
    return inputElement;
  }

  return (
    <div className={`relative w-full ${wrapperClassName}`.trim()}>
      {name ? <input type="hidden" name={name} value={normalizedValue} /> : null}
      {inputElement}
      {showCurrencySuffix ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted"
        >
          ₫
        </span>
      ) : null}
    </div>
  );
}

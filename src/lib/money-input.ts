export interface MoneyInputOptions {
  allowNegative?: boolean;
}

const MAX_INT_DIGITS = 13;
const MAX_DEC_DIGITS = 2;

/**
 * Sanitizes raw user input into an editable numeric draft string (no commas),
 * preserving in-progress typing states like "-", "1000.", and "1000.0".
 */
export function sanitizeMoneyDraft(
  input: string | number | null | undefined,
  options: MoneyInputOptions = {}
): string {
  if (input === null || input === undefined) return '';
  const allowNegative = options.allowNegative ?? false;
  const str = String(input).trim();
  if (!str) return '';

  const isNegative = allowNegative && str.startsWith('-');
  let intPart = '';
  let decPart = '';
  let hasDot = false;

  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (ch >= '0' && ch <= '9') {
      if (!hasDot) {
        if (intPart.length < MAX_INT_DIGITS) {
          intPart += ch;
        }
      } else if (decPart.length < MAX_DEC_DIGITS) {
        decPart += ch;
      }
    } else if (ch === '.' && !hasDot) {
      hasDot = true;
    }
  }

  if (!intPart && !hasDot) {
    return isNegative ? '-' : '';
  }

  if (intPart) {
    intPart = intPart.replace(/^0+(?=\d)/, '');
  } else if (hasDot) {
    intPart = '0';
  }

  const sign = isNegative ? '-' : '';
  return hasDot ? `${sign}${intPart}.${decPart}` : `${sign}${intPart}`;
}

/**
 * Normalizes a draft or stored money value into a canonical unformatted numeric string
 * suitable for form submission and database storage (e.g. "100,000.00" -> "100000", "1,000.5" -> "1000.5").
 */
export function normalizeMoneyValue(
  input: string | number | null | undefined,
  options: MoneyInputOptions = {}
): string {
  const draft = sanitizeMoneyDraft(input, options);
  if (!draft || draft === '-') return '';

  const isNegative = draft.startsWith('-');
  const unsigned = isNegative ? draft.slice(1) : draft;
  const [intPart, decPart] = unsigned.split('.');

  let cleanDec = decPart ?? '';
  if (cleanDec && /^0+$/.test(cleanDec)) {
    cleanDec = '';
  }

  if (intPart === '0' && !cleanDec) {
    return '0';
  }

  const sign = isNegative ? '-' : '';
  return cleanDec ? `${sign}${intPart}.${cleanDec}` : `${sign}${intPart}`;
}

/**
 * Formats a sanitized money draft with comma thousands separators (e.g. "100000" -> "100,000").
 */
export function formatMoneyDraft(
  draft: string,
  options: { stripTrailingZeroDecimals?: boolean } = {}
): string {
  if (!draft) return '';
  if (draft === '-') return '-';

  const isNegative = draft.startsWith('-');
  const unsigned = isNegative ? draft.slice(1) : draft;
  const hasDot = unsigned.includes('.');
  const [rawInt, rawDec = ''] = unsigned.split('.');

  const formattedInt = rawInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = isNegative ? '-' : '';

  if (!hasDot) {
    return `${sign}${formattedInt}`;
  }

  if (options.stripTrailingZeroDecimals && (!rawDec || /^0+$/.test(rawDec))) {
    return `${sign}${formattedInt}`;
  }

  return `${sign}${formattedInt}.${rawDec}`;
}

/**
 * Computes the caret index in the newly formatted display string by preserving
 * the number of significant numeric characters before the cursor.
 */
export function computeFormattedCaret(
  rawBeforeCaret: string,
  formatted: string,
  allowNegative = false
): number {
  let sigCount = 0;
  let seenDot = false;

  for (let i = 0; i < rawBeforeCaret.length; i += 1) {
    const ch = rawBeforeCaret[i];
    if (ch >= '0' && ch <= '9') {
      sigCount += 1;
    } else if (ch === '.' && !seenDot) {
      seenDot = true;
      sigCount += 1;
    } else if (ch === '-' && i === 0 && allowNegative) {
      sigCount += 1;
    }
  }

  if (sigCount === 0) return 0;

  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    const ch = formatted[i];
    if ((ch >= '0' && ch <= '9') || ch === '.' || ch === '-') {
      seen += 1;
      if (seen === sigCount) {
        return i + 1;
      }
    }
  }

  return formatted.length;
}

import { propertyValue, type DataRow } from './rules';

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'ref'; key: string }
  | { type: 'ident'; name: string }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' };

export type FormulaValue = string | number | boolean | null;

const MAX_EXPRESSION_LENGTH = 500;
const MAX_DEPTH = 32;
const FUNCTIONS = new Set(['round', 'abs', 'min', 'max', 'if', 'concat', 'coalesce', 'len', 'lower', 'upper']);

function tokenize(expression: string): Token[] {
  const input = expression.trim();
  if (!input) throw new Error('Công thức không được để trống');
  if (input.length > MAX_EXPRESSION_LENGTH) throw new Error('Công thức quá dài (tối đa 500 ký tự)');

  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '{') {
      const end = input.indexOf('}', i + 1);
      if (end < 0) throw new Error('Thiếu dấu đóng "}" cho tên thuộc tính');
      const key = input.slice(i + 1, end).trim();
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) throw new Error(`Tên thuộc tính không hợp lệ: ${key}`);
      tokens.push({ type: 'ref', key });
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++;
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          str += input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      if (i >= input.length) throw new Error('Chuỗi ký tự chưa được đóng');
      i++;
      tokens.push({ type: 'string', value: str });
      continue;
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(input[i + 1] ?? ''))) {
      let end = i;
      let hasDot = false;
      while (end < input.length && (/\d/.test(input[end]) || (input[end] === '.' && !hasDot))) {
        if (input[end] === '.') hasDot = true;
        end++;
      }
      const num = Number(input.slice(i, end));
      if (!Number.isFinite(num)) throw new Error('Giá trị số không hợp lệ');
      tokens.push({ type: 'number', value: num });
      i = end;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let end = i;
      while (end < input.length && /[a-zA-Z0-9_]/.test(input[end])) end++;
      const word = input.slice(i, end);
      const lower = word.toLowerCase();
      if (lower === 'true' || lower === 'false') {
        tokens.push({ type: 'boolean', value: lower === 'true' });
      } else {
        tokens.push({ type: 'ident', name: lower });
      }
      i = end;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (['==', '!=', '>=', '<='].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }
    if (['+', '-', '*', '/', '>', '<'].includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }
    throw new Error(`Ký tự không hợp lệ trong công thức: ${ch}`);
  }

  return tokens;
}

type Node =
  | { kind: 'literal'; value: FormulaValue }
  | { kind: 'ref'; key: string }
  | { kind: 'unary'; op: '-'; operand: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] };

function parseExpression(tokens: Token[]): { ast: Node; refs: Set<string> } {
  let pos = 0;
  const refs = new Set<string>();

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseComparison(depth: number): Node {
    if (depth > MAX_DEPTH) throw new Error('Công thức lồng nhau quá sâu');
    let left = parseAdditive(depth + 1);
    while (peek()?.type === 'op' && ['==', '!=', '>', '<', '>=', '<='].includes((peek() as { value: string }).value)) {
      const op = (consume() as { value: string }).value;
      const right = parseAdditive(depth + 1);
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  function parseAdditive(depth: number): Node {
    if (depth > MAX_DEPTH) throw new Error('Công thức lồng nhau quá sâu');
    let left = parseMultiplicative(depth + 1);
    while (peek()?.type === 'op' && ['+', '-'].includes((peek() as { value: string }).value)) {
      const op = (consume() as { value: string }).value;
      const right = parseMultiplicative(depth + 1);
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  function parseMultiplicative(depth: number): Node {
    if (depth > MAX_DEPTH) throw new Error('Công thức lồng nhau quá sâu');
    let left = parseUnary(depth + 1);
    while (peek()?.type === 'op' && ['*', '/'].includes((peek() as { value: string }).value)) {
      const op = (consume() as { value: string }).value;
      const right = parseUnary(depth + 1);
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  function parseUnary(depth: number): Node {
    if (depth > MAX_DEPTH) throw new Error('Công thức lồng nhau quá sâu');
    const token = peek();
    if (token?.type === 'op' && token.value === '-') {
      consume();
      return { kind: 'unary', op: '-', operand: parseUnary(depth + 1) };
    }
    return parsePrimary(depth + 1);
  }

  function parsePrimary(depth: number): Node {
    if (depth > MAX_DEPTH) throw new Error('Công thức lồng nhau quá sâu');
    const token = peek();
    if (!token) throw new Error('Công thức chưa hoàn chỉnh');
    if (token.type === 'number' || token.type === 'string' || token.type === 'boolean') {
      consume();
      return { kind: 'literal', value: token.value };
    }
    if (token.type === 'ref') {
      consume();
      refs.add(token.key);
      return { kind: 'ref', key: token.key };
    }
    if (token.type === 'ident') {
      consume();
      const next = peek();
      if (next?.type !== 'paren' || next.value !== '(') {
        throw new Error(`Dùng dấu ngoặc nhọn {${token.name}} để tham chiếu thuộc tính hoặc gọi hàm hợp lệ`);
      }
      if (!FUNCTIONS.has(token.name)) {
        throw new Error(`Hàm không được hỗ trợ: ${token.name}`);
      }
      consume(); // '('
      const args: Node[] = [];
      if (!(peek()?.type === 'paren' && (peek() as { value: string }).value === ')')) {
        while (true) {
          args.push(parseComparison(depth + 1));
          if (peek()?.type === 'comma') {
            consume();
            continue;
          }
          break;
        }
      }
      const closing = consume();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error(`Thiếu dấu ")" khi gọi hàm ${token.name}`);
      }
      return { kind: 'call', name: token.name, args };
    }
    if (token.type === 'paren' && token.value === '(') {
      consume();
      const inner = parseComparison(depth + 1);
      const closing = consume();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error('Thiếu dấu đóng ngoặc ")"');
      }
      return inner;
    }
    throw new Error('Cú pháp công thức không hợp lệ');
  }

  const ast = parseComparison(0);
  if (pos < tokens.length) throw new Error('Thừa ký tự ở cuối công thức');
  return { ast, refs };
}

function toNumber(value: FormulaValue): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function evalNode(node: Node, row: DataRow): FormulaValue {
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'ref': {
      const raw = propertyValue(row, node.key);
      if (raw == null || raw === '') return null;
      if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
      if (typeof raw === 'string') {
        if (/^-?\d+(\.\d+)?$/.test(raw.trim())) return Number(raw);
        return raw;
      }
      if (Array.isArray(raw)) return raw.join(', ');
      return String(raw);
    }
    case 'unary': {
      const val = evalNode(node.operand, row);
      return -toNumber(val);
    }
    case 'binary': {
      const left = evalNode(node.left, row);
      const right = evalNode(node.right, row);
      switch (node.op) {
        case '+':
          if (typeof left === 'string' || typeof right === 'string') {
            return `${left ?? ''}${right ?? ''}`;
          }
          return Number((toNumber(left) + toNumber(right)).toFixed(6));
        case '-':
          return Number((toNumber(left) - toNumber(right)).toFixed(6));
        case '*':
          return Number((toNumber(left) * toNumber(right)).toFixed(6));
        case '/': {
          const denom = toNumber(right);
          if (denom === 0) return null;
          return Number((toNumber(left) / denom).toFixed(6));
        }
        case '==':
          return left === right || String(left ?? '') === String(right ?? '');
        case '!=':
          return !(left === right || String(left ?? '') === String(right ?? ''));
        case '>':
          return toNumber(left) > toNumber(right);
        case '<':
          return toNumber(left) < toNumber(right);
        case '>=':
          return toNumber(left) >= toNumber(right);
        case '<=':
          return toNumber(left) <= toNumber(right);
        default:
          return null;
      }
    }
    case 'call': {
      const args = node.args.map(arg => evalNode(arg, row));
      switch (node.name) {
        case 'round': {
          const val = toNumber(args[0] ?? 0);
          const digits = Math.max(0, Math.min(6, Math.trunc(toNumber(args[1] ?? 0))));
          const factor = 10 ** digits;
          return Math.round(val * factor) / factor;
        }
        case 'abs':
          return Math.abs(toNumber(args[0] ?? 0));
        case 'min':
          return args.length ? Math.min(...args.map(toNumber)) : 0;
        case 'max':
          return args.length ? Math.max(...args.map(toNumber)) : 0;
        case 'if':
          return args[0] ? (args[1] ?? null) : (args[2] ?? null);
        case 'concat':
          return args.map(v => (v == null ? '' : String(v))).join('');
        case 'coalesce':
          return args.find(v => v !== null && v !== '') ?? null;
        case 'len':
          return String(args[0] ?? '').length;
        case 'lower':
          return String(args[0] ?? '').toLocaleLowerCase('vi');
        case 'upper':
          return String(args[0] ?? '').toLocaleUpperCase('vi');
        default:
          return null;
      }
    }
  }
}

const astCache = new Map<string, { ast: Node; refs: Set<string> }>();

function compileFormula(expression: string): { ast: Node; refs: Set<string> } {
  const cached = astCache.get(expression);
  if (cached) return cached;
  const tokens = tokenize(expression);
  const parsed = parseExpression(tokens);
  if (astCache.size > 200) astCache.clear();
  astCache.set(expression, parsed);
  return parsed;
}

export function validateFormula(expression: string, allowedKeys: Iterable<string>): { refs: string[] } {
  const { refs } = compileFormula(expression);
  const allowed = new Set(allowedKeys);
  for (const key of refs) {
    if (!allowed.has(key)) {
      throw new Error(`Thuộc tính không tồn tại trong công thức: {${key}}`);
    }
  }
  return { refs: [...refs] };
}

export function evaluateFormula(expression: string, row: DataRow): FormulaValue {
  try {
    const { ast } = compileFormula(expression);
    return evalNode(ast, row);
  } catch {
    return null;
  }
}

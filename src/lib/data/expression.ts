import type { CellValue, Row } from "@/lib/model/types";
import { parseNumber } from "./schema";

/**
 * Tiny, safe expression language for calculated columns. No eval.
 *
 *   revenue - cost
 *   [unit price] * units
 *   round((revenue - cost) / revenue * 100, 1)
 *   concat(region, " / ", channel)
 *
 * Supports + - * /, parentheses, numbers, "strings", column names (bare
 * identifiers or [bracketed names]) and functions: round, abs, min, max,
 * coalesce, concat, upper, lower, if(cond, a, b) with comparisons > < >= <= = !=.
 */

type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" };

export class ExpressionError extends Error {}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (Number.isNaN(n)) throw new ExpressionError(`Invalid number “${src.slice(i, j)}”`);
      tokens.push({ t: "num", v: n });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) j++;
      if (j >= src.length) throw new ExpressionError("Unclosed string");
      tokens.push({ t: "str", v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (ch === "[") {
      const j = src.indexOf("]", i);
      if (j < 0) throw new ExpressionError("Unclosed [column] reference");
      tokens.push({ t: "id", v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if ([">=", "<=", "!=", "=="].includes(two)) {
      tokens.push({ t: "op", v: two === "==" ? "=" : two });
      i += 2;
      continue;
    }
    if ("+-*/><=".includes(ch)) {
      tokens.push({ t: "op", v: ch });
      i++;
      continue;
    }
    if (ch === "(") tokens.push({ t: "lp" });
    else if (ch === ")") tokens.push({ t: "rp" });
    else if (ch === ",") tokens.push({ t: "comma" });
    else throw new ExpressionError(`Unexpected character “${ch}”`);
    i++;
  }
  return tokens;
}

export type Expr =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "col"; name: string }
  | { k: "bin"; op: string; a: Expr; b: Expr }
  | { k: "neg"; a: Expr }
  | { k: "call"; fn: string; args: Expr[] };

const FUNCTIONS = ["round", "abs", "min", "max", "coalesce", "concat", "upper", "lower", "if"];

export function parseExpression(src: string): Expr {
  if (!src.trim()) throw new ExpressionError("Expression is empty");
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  function comparison(): Expr {
    let left = additive();
    let tok = peek();
    while (tok && tok.t === "op" && [">", "<", ">=", "<=", "=", "!="].includes(tok.v)) {
      eat();
      left = { k: "bin", op: tok.v, a: left, b: additive() };
      tok = peek();
    }
    return left;
  }
  function additive(): Expr {
    let left = term();
    let tok = peek();
    while (tok && tok.t === "op" && (tok.v === "+" || tok.v === "-")) {
      eat();
      left = { k: "bin", op: tok.v, a: left, b: term() };
      tok = peek();
    }
    return left;
  }
  function term(): Expr {
    let left = unary();
    let tok = peek();
    while (tok && tok.t === "op" && (tok.v === "*" || tok.v === "/")) {
      eat();
      left = { k: "bin", op: tok.v, a: left, b: unary() };
      tok = peek();
    }
    return left;
  }
  function unary(): Expr {
    const tok = peek();
    if (tok && tok.t === "op" && tok.v === "-") {
      eat();
      return { k: "neg", a: unary() };
    }
    return primary();
  }
  function primary(): Expr {
    const tok = eat();
    if (!tok) throw new ExpressionError("Unexpected end of expression");
    if (tok.t === "num") return { k: "num", v: tok.v };
    if (tok.t === "str") return { k: "str", v: tok.v };
    if (tok.t === "lp") {
      const e = comparison();
      if (eat()?.t !== "rp") throw new ExpressionError("Missing closing parenthesis");
      return e;
    }
    if (tok.t === "id") {
      const next = peek();
      if (next && next.t === "lp") {
        const fn = tok.v.toLowerCase();
        if (!FUNCTIONS.includes(fn)) throw new ExpressionError(`Unknown function “${tok.v}”`);
        eat();
        const args: Expr[] = [];
        if (peek()?.t !== "rp") {
          args.push(comparison());
          while (peek()?.t === "comma") {
            eat();
            args.push(comparison());
          }
        }
        if (eat()?.t !== "rp") throw new ExpressionError(`Missing “)” after ${fn}(`);
        return { k: "call", fn, args };
      }
      return { k: "col", name: tok.v };
    }
    throw new ExpressionError("Unexpected token");
  }

  const expr = comparison();
  if (pos < tokens.length) throw new ExpressionError("Unexpected input after expression");
  return expr;
}

export function referencedColumns(expr: Expr, out = new Set<string>()): Set<string> {
  switch (expr.k) {
    case "col":
      out.add(expr.name);
      break;
    case "bin":
      referencedColumns(expr.a, out);
      referencedColumns(expr.b, out);
      break;
    case "neg":
      referencedColumns(expr.a, out);
      break;
    case "call":
      expr.args.forEach((a) => referencedColumns(a, out));
      break;
  }
  return out;
}

function num(v: CellValue): number | null {
  return typeof v === "number" ? v : parseNumber(v);
}

export function evaluate(expr: Expr, row: Row): CellValue {
  switch (expr.k) {
    case "num":
      return expr.v;
    case "str":
      return expr.v;
    case "col":
      return row[expr.name] ?? null;
    case "neg": {
      const a = num(evaluate(expr.a, row));
      return a === null ? null : -a;
    }
    case "bin": {
      const av = evaluate(expr.a, row);
      const bv = evaluate(expr.b, row);
      if (["=", "!=", ">", "<", ">=", "<="].includes(expr.op)) {
        const an = num(av);
        const bn = num(bv);
        const [x, y] = an !== null && bn !== null ? [an, bn] : [String(av ?? ""), String(bv ?? "")];
        switch (expr.op) {
          case "=":
            return x === y;
          case "!=":
            return x !== y;
          case ">":
            return x > y;
          case "<":
            return x < y;
          case ">=":
            return x >= y;
          default:
            return x <= y;
        }
      }
      const a = num(av);
      const b = num(bv);
      if (a === null || b === null) return null;
      switch (expr.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        default:
          return b === 0 ? null : a / b;
      }
    }
    case "call": {
      const args = expr.args.map((a) => evaluate(a, row));
      switch (expr.fn) {
        case "round": {
          const n = num(args[0]);
          const d = num(args[1] ?? 0) ?? 0;
          if (n === null) return null;
          const f = 10 ** d;
          return Math.round(n * f) / f;
        }
        case "abs": {
          const n = num(args[0]);
          return n === null ? null : Math.abs(n);
        }
        case "min":
        case "max": {
          const ns = args.map(num).filter((n): n is number => n !== null);
          return ns.length ? (expr.fn === "min" ? Math.min(...ns) : Math.max(...ns)) : null;
        }
        case "coalesce":
          return args.find((a) => a !== null && a !== "") ?? null;
        case "concat":
          return args.map((a) => (a === null ? "" : String(a))).join("");
        case "upper":
          return args[0] === null ? null : String(args[0]).toUpperCase();
        case "lower":
          return args[0] === null ? null : String(args[0]).toLowerCase();
        case "if":
          return args[0] ? (args[1] ?? null) : (args[2] ?? null);
      }
      return null;
    }
  }
}

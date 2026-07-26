import type { FormulaNode } from "./types.js";

/** Atalhos para montar FormulaNode em código (defaults, migrações, testes). */
export const constant = (value: number): FormulaNode => ({ op: "const", value });
export const variable = (key: string): FormulaNode => ({ op: "var", key });
export const add = (...args: FormulaNode[]): FormulaNode => ({ op: "add", args });
export const sub = (...args: FormulaNode[]): FormulaNode => ({ op: "sub", args });
export const mul = (...args: FormulaNode[]): FormulaNode => ({ op: "mul", args });
export const div = (...args: FormulaNode[]): FormulaNode => ({ op: "div", args });
export const min = (...args: FormulaNode[]): FormulaNode => ({ op: "min", args });
export const max = (...args: FormulaNode[]): FormulaNode => ({ op: "max", args });
export const floor = (arg: FormulaNode): FormulaNode => ({ op: "floor", arg });
export const ceil = (arg: FormulaNode): FormulaNode => ({ op: "ceil", arg });
export const abs = (arg: FormulaNode): FormulaNode => ({ op: "abs", arg });
export const lookup = (
  key: string,
  table: Record<string, number>,
  fallback?: FormulaNode
): FormulaNode => ({ op: "lookup", key, table, fallback });

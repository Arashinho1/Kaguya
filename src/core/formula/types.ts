/**
 * Structured formula AST. Every guild-configurable rule (chakra, custo de treino, XP de
 * perícia, efeitos de jutsu/item) é uma árvore desse tipo — nunca uma string avaliada
 * (sem eval, sem código arbitrário). O avaliador em evaluate.ts só reconhece estes nós.
 */
export type FormulaNode =
  | { op: "const"; value: number }
  | { op: "var"; key: string }
  | { op: "add"; args: FormulaNode[] }
  | { op: "sub"; args: FormulaNode[] }
  | { op: "mul"; args: FormulaNode[] }
  | { op: "div"; args: FormulaNode[] }
  | { op: "min"; args: FormulaNode[] }
  | { op: "max"; args: FormulaNode[] }
  | { op: "floor"; arg: FormulaNode }
  | { op: "ceil"; arg: FormulaNode }
  | { op: "abs"; arg: FormulaNode }
  | { op: "lookup"; key: string; table: Record<string, number>; fallback?: FormulaNode };

/** Contexto de avaliação: valores numéricos (para `var`) e/ou textuais (para `lookup`). */
export type FormulaContext = Record<string, number | string>;

export class FormulaError extends Error {}

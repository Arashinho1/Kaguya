import { z } from "zod";

import type { FormulaNode } from "./types.js";

/**
 * Valida a forma de um FormulaNode vindo do banco (JSON não confiável). z.lazy cobre a
 * recursão; MAX_FORMULA_NODES em evaluate.ts cobre o limite de tamanho/profundidade em
 * tempo de avaliação (o zod sozinho não limita quantos nós uma árvore pode ter).
 */
export const formulaNodeSchema: z.ZodType<FormulaNode> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("const"), value: z.number().finite() }),
    z.object({ op: z.literal("var"), key: z.string().min(1) }),
    z.object({ op: z.literal("add"), args: z.array(formulaNodeSchema).min(1) }),
    z.object({ op: z.literal("sub"), args: z.array(formulaNodeSchema).min(1) }),
    z.object({ op: z.literal("mul"), args: z.array(formulaNodeSchema).min(1) }),
    z.object({ op: z.literal("div"), args: z.array(formulaNodeSchema).min(1) }),
    z.object({ op: z.literal("min"), args: z.array(formulaNodeSchema).min(1) }),
    z.object({ op: z.literal("max"), args: z.array(formulaNodeSchema).min(1) }),
    z.object({ op: z.literal("floor"), arg: formulaNodeSchema }),
    z.object({ op: z.literal("ceil"), arg: formulaNodeSchema }),
    z.object({ op: z.literal("abs"), arg: formulaNodeSchema }),
    z.object({
      op: z.literal("lookup"),
      key: z.string().min(1),
      table: z.record(z.string(), z.number().finite()),
      fallback: formulaNodeSchema.optional()
    })
  ])
);

export function parseFormula(value: unknown): FormulaNode {
  return formulaNodeSchema.parse(value);
}

export function safeParseFormula(value: unknown): FormulaNode | null {
  const result = formulaNodeSchema.safeParse(value);
  return result.success ? result.data : null;
}

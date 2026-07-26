import type { FormulaNode } from "./types.js";

/** Representação legível de uma fórmula, para exibir em embeds/painéis do Discord. */
export function formatFormula(node: FormulaNode): string {
  switch (node.op) {
    case "const":
      return String(node.value);
    case "var":
      return node.key;
    case "add":
      return `(${node.args.map(formatFormula).join(" + ")})`;
    case "sub":
      return `(${node.args.map(formatFormula).join(" - ")})`;
    case "mul":
      return `(${node.args.map(formatFormula).join(" * ")})`;
    case "div":
      return `(${node.args.map(formatFormula).join(" / ")})`;
    case "min":
      return `min(${node.args.map(formatFormula).join(", ")})`;
    case "max":
      return `max(${node.args.map(formatFormula).join(", ")})`;
    case "floor":
      return `floor(${formatFormula(node.arg)})`;
    case "ceil":
      return `ceil(${formatFormula(node.arg)})`;
    case "abs":
      return `abs(${formatFormula(node.arg)})`;
    case "lookup":
      return `lookup(${node.key})`;
    default: {
      const exhaustive: never = node;
      return JSON.stringify(exhaustive);
    }
  }
}

import { FormulaError, type FormulaContext, type FormulaNode } from "./types.js";

/** Guarda contra fórmulas patológicas (JSON gigante/profundo) travando o processo. */
const MAX_NODES = 500;
const MAX_DEPTH = 64;

export function evaluateFormula(node: FormulaNode, context: FormulaContext = {}): number {
  const nodeCounter = { count: 0 };
  return evaluateNode(node, context, 0, nodeCounter);
}

function evaluateNode(
  node: FormulaNode,
  context: FormulaContext,
  depth: number,
  counter: { count: number }
): number {
  if (depth > MAX_DEPTH) {
    throw new FormulaError(`Fórmula excede a profundidade máxima permitida (${MAX_DEPTH}).`);
  }

  counter.count += 1;
  if (counter.count > MAX_NODES) {
    throw new FormulaError(`Fórmula excede o número máximo de nós permitido (${MAX_NODES}).`);
  }

  switch (node.op) {
    case "const":
      return node.value;

    case "var": {
      const value = context[node.key];
      if (typeof value !== "number") {
        return 0;
      }
      return value;
    }

    case "add":
      return node.args.reduce(
        (total, arg) => total + evaluateNode(arg, context, depth + 1, counter),
        0
      );

    case "sub": {
      const [first, ...rest] = node.args.map((arg) => evaluateNode(arg, context, depth + 1, counter));
      return rest.reduce((total, value) => total - value, first ?? 0);
    }

    case "mul":
      return node.args.reduce(
        (total, arg) => total * evaluateNode(arg, context, depth + 1, counter),
        1
      );

    case "div": {
      const [first, ...rest] = node.args.map((arg) => evaluateNode(arg, context, depth + 1, counter));
      return rest.reduce((total, value) => (value === 0 ? total : total / value), first ?? 0);
    }

    case "min":
      return Math.min(...node.args.map((arg) => evaluateNode(arg, context, depth + 1, counter)));

    case "max":
      return Math.max(...node.args.map((arg) => evaluateNode(arg, context, depth + 1, counter)));

    case "floor":
      return Math.floor(evaluateNode(node.arg, context, depth + 1, counter));

    case "ceil":
      return Math.ceil(evaluateNode(node.arg, context, depth + 1, counter));

    case "abs":
      return Math.abs(evaluateNode(node.arg, context, depth + 1, counter));

    case "lookup": {
      const key = context[node.key];
      const value = typeof key === "string" ? node.table[key] : undefined;

      if (typeof value === "number") {
        return value;
      }

      return node.fallback ? evaluateNode(node.fallback, context, depth + 1, counter) : 0;
    }

    default: {
      const exhaustive: never = node;
      throw new FormulaError(`Operador de fórmula desconhecido: ${JSON.stringify(exhaustive)}`);
    }
  }
}

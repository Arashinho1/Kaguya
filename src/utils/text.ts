export function normalizeKey(input: string): string | null {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized.length === 0 || normalized.length > 40) {
    return null;
  }

  return normalized;
}

export function parseInteger(input: string | undefined): number | null {
  if (!input || !/^-?\d+$/.test(input.trim())) {
    return null;
  }

  return Number(input);
}

export function parseDecimal(input: string | undefined): number | null {
  if (!input || !/^-?\d+([.,]\d+)?$/.test(input.trim())) {
    return null;
  }

  return Number(input.trim().replace(",", "."));
}

export function parseOptionalInteger(input: string | undefined): number | null | undefined {
  const value = input?.trim();

  if (!value || ["sem", "none", "null", "-"].includes(value.toLowerCase())) {
    return null;
  }

  return parseInteger(value) ?? undefined;
}

export function splitPipeArgs(input: string): string[] {
  return input
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

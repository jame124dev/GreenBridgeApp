import { VALID_CONDITION_KEYS, type ConditionKey } from './constants';

export function parsePhpArray(meta: unknown): string[] {
  if (!meta || typeof meta !== 'string') {
    if (Array.isArray(meta)) return meta.map(String);
    return [];
  }
  try {
    const matches = [...meta.matchAll(/"([^"]+)"/g)];
    return matches.map((m) => m[1]);
  } catch {
    return [];
  }
}

export function normalizeCondition(
  value: string | string[] | undefined | null,
): ConditionKey[] {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  const joined = arr.join('').toLowerCase();
  if (
    (joined === 'used' || joined === 'usedfunctional') &&
    (arr.length > 1 || arr[0]?.toLowerCase() === 'used')
  ) {
    return ['usedFunctional'];
  }
  if (joined === 'new') return ['new'];
  if (joined === 'forparts') return ['forParts'];
  if (joined === 'wastedisposal') return ['wasteDisposal'];
  if (joined === 'demolitionremoval') return ['demolitionRemoval'];
  return arr.filter((c): c is ConditionKey =>
    (VALID_CONDITION_KEYS as readonly string[]).includes(c),
  );
}

export function normalizeOperationStatus(
  value: string | string[] | undefined | null,
): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  const parsed = parsePhpArray(value);
  if (parsed.length) return parsed;
  return [String(value)];
}

/** Retire récursivement les `undefined` — Firestore les refuse dans set()/update(). */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined) continue;
    const next = stripUndefinedDeep(val);
    if (next !== undefined) out[key] = next;
  }
  return out as T;
}

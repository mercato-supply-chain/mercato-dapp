/**
 * Pure message helpers.
 *
 * This module intentionally contains **no dictionary JSON imports** so it can be
 * imported by both server and client code without pulling any locale payload
 * into the module graph. Dictionary loading lives in `./dictionaries`.
 */

/** A dictionary-shaped object (nested namespaces of string leaves). */
export type MessageTree = Record<string, unknown>

export type Replacements = Record<string, string | number>

/** Resolve a dotted key path against a dictionary tree. */
export function lookup<T extends object>(messages: T, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (node == null || typeof node !== 'object') return undefined
    return (node as Record<string, unknown>)[part]
  }, messages as unknown)

  return typeof value === 'string' ? value : undefined
}

/** Replace `{placeholder}` tokens in a message. */
export function interpolate(value: string, replacements?: Replacements): string {
  if (!replacements) return value
  return Object.entries(replacements).reduce(
    (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)),
    value,
  )
}

/**
 * Resolve a key with fallback semantics:
 * active dictionary → fallback dictionary → the raw key.
 */
export function translate<T extends object>(
  messages: T,
  fallbackMessages: T,
  key: string,
  replacements?: Replacements,
): string {
  const text = lookup(messages, key) ?? lookup(fallbackMessages, key) ?? key
  return interpolate(text, replacements)
}

/**
 * Return the subtree at `namespace` (dotted path), or an empty object when the
 * namespace is absent. Used for namespace-scoped access in route components.
 */
export function scopedMessages<T extends object>(
  messages: T,
  namespace: string,
): MessageTree {
  const subtree = namespace
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node == null || typeof node !== 'object'
          ? undefined
          : (node as Record<string, unknown>)[part],
      messages as unknown,
    )
  return subtree && typeof subtree === 'object' ? (subtree as MessageTree) : {}
}

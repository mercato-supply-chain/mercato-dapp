/**
 * Input attributes for Stellar public keys (`G...`) and contract IDs (`C...`).
 * Prevents browsers and translators from spellchecking, auto-capitalizing,
 * auto-correcting, or rewriting case-sensitive StrKey identifiers.
 */
export const STELLAR_ADDRESS_INPUT_PROPS = {
  spellCheck: false,
  translate: 'no',
  autoComplete: 'off',
  autoCapitalize: 'off',
  autoCorrect: 'off',
} as const

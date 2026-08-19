import type { RecognitionStatus } from '../../src/types/domain';

/**
 * Wikidata's sovereign-state query returns a mix of universally recognized UN
 * members and a handful of contested or limited-recognition cases. This is a
 * deliberately small, explicit override list rather than an attempt to encode
 * full recognition graphs — see docs/DATA_SOURCES.md for methodology and the
 * acknowledged simplification.
 */
export const RECOGNITION_OVERRIDES: Record<string, RecognitionStatus> = {
  TW: 'partially-recognized', // Republic of China (Taiwan): de facto independent, recognized by a minority of UN members
  PS: 'un-observer', // State of Palestine: UN General Assembly observer state
  XK: 'partially-recognized', // Kosovo: recognized by ~100 UN member states, not a UN member itself
  EH: 'disputed', // Western Sahara / SADR: mostly controlled by Morocco, claimed by the Sahrawi Republic
  VA: 'un-observer', // Holy See: UN observer state
  CK: 'un-observer', // Cook Islands: self-governing in free association with New Zealand
  NU: 'un-observer', // Niue: self-governing in free association with New Zealand
};

export const DEFAULT_RECOGNITION: RecognitionStatus = 'un-member';

/**
 * Validation Pipeline (Phase 4)
 * Re-exports the automated validation pipeline and independent checkers.
 */
export {
  runOfferValidation,
  checkLocation,
  checkDates,
  checkText,
  checkImages,
  isFuzzyCityMatch,
  haversineDistanceKm,
  levenshteinDistance,
} from './offerValidation.js';

export { default } from './offerValidation.js';

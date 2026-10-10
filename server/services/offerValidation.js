import leoProfanity from 'leo-profanity';
import { Offer, AdminReviewLog, Vendor } from '../models/index.js';

/**
 * Calculate Haversine distance between two coordinates in kilometers.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in km
 */
export const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Compute Levenshtein distance between two strings
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export const levenshteinDistance = (a, b) => {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[bn][an];
};

/**
 * Known common Indian & global city aliases / alternate historical names
 */
const CITY_ALIASES = [
  ['mumbai', 'bombay', 'navi mumbai', 'mumbai suburban', 'thane'],
  ['bengaluru', 'bangalore', 'bangalore urban', 'bangalore rural'],
  ['kolkata', 'calcutta'],
  ['chennai', 'madras'],
  ['delhi', 'new delhi', 'nct of delhi'],
  ['gurugram', 'gurgaon'],
  ['pune', 'poona'],
  ['varanasi', 'banaras', 'benares', 'kashi'],
  ['prayagraj', 'allahabad'],
  ['vadodara', 'baroda'],
  ['kochi', 'cochin'],
  ['thiruvananthapuram', 'trivandrum'],
  ['mysuru', 'mysore'],
  ['puducherry', 'pondicherry'],
];

/**
 * Normalize a string for fuzzy comparison
 * @param {string} str
 * @returns {string}
 */
const normalizeText = (str) =>
  (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Fuzzy check if resolved city / address matches declared city
 * @param {string} declaredCity
 * @param {string} resolvedName
 * @returns {boolean}
 */
export const isFuzzyCityMatch = (declaredCity, resolvedName) => {
  const normDeclared = normalizeText(declaredCity);
  const normResolved = normalizeText(resolvedName);

  if (!normDeclared || !normResolved) return false;

  // 1. Exact match
  if (normDeclared === normResolved) return true;

  // 2. Substring match if string has meaningful length
  if (
    (normDeclared.length >= 3 && normResolved.includes(normDeclared)) ||
    (normResolved.length >= 3 && normDeclared.includes(normResolved))
  ) {
    return true;
  }

  // 3. Known city aliases check
  for (const aliasGroup of CITY_ALIASES) {
    const declaredInGroup = aliasGroup.some(
      (alias) => normDeclared === alias || normDeclared.includes(alias)
    );
    const resolvedInGroup = aliasGroup.some(
      (alias) => normResolved === alias || normResolved.includes(alias)
    );
    if (declaredInGroup && resolvedInGroup) {
      return true;
    }
  }

  // 4. Token overlap (e.g. "Navi Mumbai" vs "Mumbai")
  const declaredTokens = normDeclared.split(' ').filter((t) => t.length >= 3);
  const resolvedTokens = normResolved.split(' ').filter((t) => t.length >= 3);
  for (const dt of declaredTokens) {
    for (const rt of resolvedTokens) {
      if (dt === rt) return true;
    }
  }

  // 5. Levenshtein similarity ratio >= 0.65
  const maxLen = Math.max(normDeclared.length, normResolved.length);
  if (maxLen > 0) {
    const dist = levenshteinDistance(normDeclared, normResolved);
    const similarity = 1 - dist / maxLen;
    if (similarity >= 0.65) return true;
  }

  return false;
};

/**
 * Geocoding provider: OpenStreetMap Nominatim
 */
const geocodeWithNominatim = async (lng, lat) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OfferBazaar/1.0 (contact@offerbazaar.com)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Nominatim HTTP error ${response.status}`);
  }

  const data = await response.json();
  const address = data.address || {};
  const resolvedCity =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.suburb ||
    address.city_district ||
    address.state_district ||
    address.county ||
    data.name ||
    data.display_name ||
    '';

  return {
    city: resolvedCity,
    displayName: data.display_name || '',
    lat: data.lat ? parseFloat(data.lat) : lat,
    lon: data.lon ? parseFloat(data.lon) : lng,
  };
};

/**
 * Geocoding provider: Google Geocoding API
 */
const geocodeWithGoogle = async (lng, lat) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Google Geocoding HTTP error ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    throw new Error(`Google Geocoding error: ${data.status}`);
  }

  // Find locality or administrative area
  let resolvedCity = '';
  for (const component of data.results[0].address_components) {
    if (
      component.types.includes('locality') ||
      component.types.includes('administrative_area_level_2')
    ) {
      resolvedCity = component.long_name;
      break;
    }
  }

  return {
    city: resolvedCity || data.results[0].formatted_address,
    displayName: data.results[0].formatted_address,
    lat,
    lon: lng,
  };
};

/**
 * Forward geocode declared city using Nominatim to check ~50km distance
 */
const forwardGeocodeCity = async (cityName) => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      cityName
    )}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OfferBazaar/1.0 (contact@offerbazaar.com)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * 1. checkLocation(vendor)
 * Reverse-geocode vendor.location.coordinates using swappable provider.
 * Compare resolved locality against vendor.city using fuzzy match or ~50km threshold.
 *
 * @param {object} vendor
 * @returns {Promise<{ passed: boolean, reason: string, uncertain?: boolean }>}
 */
export const checkLocation = async (vendor) => {
  if (
    !vendor ||
    !vendor.location ||
    !Array.isArray(vendor.location.coordinates) ||
    vendor.location.coordinates.length !== 2
  ) {
    return {
      passed: false,
      reason: 'Shop coordinates are missing or invalid',
    };
  }

  const [lng, lat] = vendor.location.coordinates;
  const declaredCity = vendor.city || '';

  if (!declaredCity.trim()) {
    return {
      passed: false,
      reason: 'Vendor city is not declared',
    };
  }

  const provider = (
    process.env.GEOCODING_PROVIDER || 'nominatim'
  ).toLowerCase();

  let geocoded;
  try {
    if (provider === 'google') {
      geocoded = await geocodeWithGoogle(lng, lat);
    } else {
      geocoded = await geocodeWithNominatim(lng, lat);
    }
  } catch (error) {
    // Network error or provider down -> uncertain for manual review
    return {
      passed: false,
      uncertain: true,
      reason: `Geocoding verification could not be completed: ${error.message}`,
    };
  }

  // 1. Fuzzy string match against resolved locality / display name
  const isMatch =
    isFuzzyCityMatch(declaredCity, geocoded.city) ||
    isFuzzyCityMatch(declaredCity, geocoded.displayName);

  if (isMatch) {
    return { passed: true, reason: '' };
  }

  // 2. Check if resolved location is within roughly 50km of where vendor.city geocodes to
  const cityCoords = await forwardGeocodeCity(declaredCity);
  if (cityCoords) {
    const distanceKm = haversineDistanceKm(
      lat,
      lng,
      cityCoords.lat,
      cityCoords.lon
    );
    if (distanceKm <= 50) {
      return { passed: true, reason: '' };
    }
  }

  return {
    passed: false,
    reason: "Shop coordinates don't match the declared city",
  };
};

/**
 * 2. checkDates(offer)
 * - Fail if validTill <= validFrom
 * - Fail if validFrom is more than 3 days in the past at submission time
 * - Fail if validTill is more than 1 year from validFrom
 *
 * @param {object} offer
 * @returns {{ passed: boolean, reason: string }}
 */
export const checkDates = (offer) => {
  if (!offer || !offer.validFrom || !offer.validTill) {
    return {
      passed: false,
      reason: 'Offer dates (validFrom and validTill) are required',
    };
  }

  const from = new Date(offer.validFrom);
  const till = new Date(offer.validTill);

  if (Number.isNaN(from.getTime()) || Number.isNaN(till.getTime())) {
    return {
      passed: false,
      reason: 'Offer dates provided are invalid date objects',
    };
  }

  // 1. validTill must be strictly greater than validFrom
  if (till.getTime() <= from.getTime()) {
    return {
      passed: false,
      reason: 'Valid till date must be strictly after valid from date',
    };
  }

  // 2. validFrom cannot be more than 3 days in the past at submission time
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  if (from.getTime() < now - threeDaysMs) {
    return {
      passed: false,
      reason: 'Valid from date cannot be more than 3 days in the past',
    };
  }

  // 3. validTill cannot be more than 1 year from validFrom
  const oneYearMs = 366 * 24 * 60 * 60 * 1000; // Account for leap years
  if (till.getTime() - from.getTime() > oneYearMs) {
    return {
      passed: false,
      reason: 'Offer validity period cannot exceed 1 year',
    };
  }

  return { passed: true, reason: '' };
};

/**
 * 3. checkText(offer)
 * Rule-based pre-checks:
 * - Fail if description is under 10 or over 500 characters
 * - Fail if discountText > 500 characters
 * - Fail on blanket-scam pattern (>=90% + "all products", "everything", "entire store")
 * - Fail on profanity
 * LLM Layer:
 * - Call LLM with strict JSON format { "valid": true|false, "reason": "" }
 * - Defensive parsing -> unparseable -> uncertain (flagged_for_review)
 *
 * @param {object} offer
 * @returns {Promise<{ passed: boolean, reason: string, uncertain?: boolean }>}
 */
export const checkText = async (offer) => {
  if (!offer) {
    return { passed: false, reason: 'Offer data is missing' };
  }

  const description = (offer.description || '').trim();
  const discountText = (offer.discountText || '').trim();
  const title = (offer.title || '').trim();

  // Rule 1: Character length validation
  if (description.length < 10 || description.length > 500) {
    return {
      passed: false,
      reason: 'Offer description must be between 10 and 500 characters',
    };
  }

  if (discountText.length > 500) {
    return {
      passed: false,
      reason: 'Offer discount text cannot exceed 500 characters',
    };
  }

  const combinedText = `${title} ${description} ${discountText}`;

  // Rule 2: Blanket-scam pattern (percentage >= 90 combined with blanket scope phrases)
  const hasHighPercentage =
    /(?:\b(9\d|100)\s*%|\b(9\d|100)\s*percent\b|\bflat\s*(9\d|100)\s*%)/i.test(
      combinedText
    );
  const hasBlanketScope =
    /\b(all\s+products|everything|entire\s+store|whole\s+store|all\s+items|storewide|all\s+stock)\b/i.test(
      combinedText
    );

  if (hasHighPercentage && hasBlanketScope) {
    return {
      passed: false,
      reason:
        'Offer flagged for suspicious blanket discount claim (>=90% off entire inventory)',
    };
  }

  // Rule 3: Profanity check using leo-profanity
  if (leoProfanity.check(combinedText)) {
    return {
      passed: false,
      reason: 'Offer contains inappropriate or profane language',
    };
  }

  // LLM Layer: Retail coherence and plausibility check
  const endpoint =
    process.env.LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  // If no API key configured, treat defensively as uncertain (flagged_for_review)
  if (!apiKey) {
    return {
      passed: false,
      uncertain: true,
      reason: 'LLM API key is not configured for text coherence verification',
    };
  }

  const systemPrompt = `You are an automated retail offer auditor.
Evaluate whether the following offer text is a plausible, internally coherent retail offer.
You must reply ONLY with a strict JSON object with this exact shape:
{"valid": true|false, "reason": ""}
Do not wrap your response in markdown code fences or add explanations outside the JSON object.`;

  const userPrompt = `Title: ${title}
Description: ${description}
Discount: ${discountText || 'None'}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        passed: false,
        uncertain: true,
        reason: `LLM API returned HTTP error ${response.status}`,
      };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Defensive parsing: strip possible markdown fences or extra whitespace
    const cleaned = rawContent.replace(/```(?:json)?|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        passed: false,
        uncertain: true,
        reason: 'LLM text validation returned an unparseable response',
      };
    }

    if (typeof parsed !== 'object' || typeof parsed.valid !== 'boolean') {
      return {
        passed: false,
        uncertain: true,
        reason: 'LLM text validation response did not match expected schema',
      };
    }

    if (!parsed.valid) {
      return {
        passed: false,
        reason:
          parsed.reason ||
          'Offer text was judged implausible or incoherent for a retail promotion',
      };
    }

    return { passed: true, reason: '' };
  } catch (error) {
    return {
      passed: false,
      uncertain: true,
      reason: `LLM text verification failed to execute: ${error.message}`,
    };
  }
};

/**
 * 4. checkImages(offer)
 * - Fail immediately if no images present
 * - Check Cloudinary moderation if configured
 * - Call vision-capable LLM to verify images plausibly show shop, storefront, or product
 * - Defensive parsing -> unparseable -> uncertain (flagged_for_review)
 *
 * @param {object} offer
 * @returns {Promise<{ passed: boolean, reason: string, uncertain?: boolean }>}
 */
export const checkImages = async (offer) => {
  if (
    !offer ||
    !offer.images ||
    !Array.isArray(offer.images) ||
    offer.images.length === 0
  ) {
    return {
      passed: false,
      reason: 'At least one offer image is required',
    };
  }

  const imageUrls = offer.images.filter(
    (url) => typeof url === 'string' && url.trim().length > 0
  );
  if (imageUrls.length === 0) {
    return {
      passed: false,
      reason: 'At least one valid offer image URL is required',
    };
  }

  // Cloudinary moderation add-on check (if configured)
  if (process.env.CLOUDINARY_MODERATION_ENABLED === 'true') {
    const hasRejectedModeration = imageUrls.some((url) =>
      url.includes('moderation_rejected')
    );
    if (hasRejectedModeration) {
      return {
        passed: false,
        reason: 'One or more images failed automated moderation checks',
      };
    }
  }

  // Vision LLM layer
  const endpoint =
    process.env.LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return {
      passed: false,
      uncertain: true,
      reason: 'LLM API key is not configured for image verification',
    };
  }

  const systemPrompt = `You are an automated visual auditor for retail promotions.
Determine whether the provided image(s) plausibly show a retail shop, storefront, or product.
Reply ONLY with a strict JSON object with this exact shape:
{"valid": true|false, "reason": ""}
Do not wrap your response in markdown code fences or add explanations outside the JSON object.`;

  const userContent = [
    {
      type: 'text',
      text: 'Do these images plausibly show a shop, storefront, or retail product?',
    },
    ...imageUrls.map((url) => ({
      type: 'image_url',
      image_url: { url },
    })),
  ];

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return {
        passed: false,
        uncertain: true,
        reason: `Vision LLM API returned HTTP error ${response.status}`,
      };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    const cleaned = rawContent.replace(/```(?:json)?|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        passed: false,
        uncertain: true,
        reason: 'Vision validation returned an unparseable response',
      };
    }

    if (typeof parsed !== 'object' || typeof parsed.valid !== 'boolean') {
      return {
        passed: false,
        uncertain: true,
        reason: 'Vision validation response did not match expected schema',
      };
    }

    if (!parsed.valid) {
      return {
        passed: false,
        reason:
          parsed.reason ||
          'Image does not plausibly show a shop, storefront, or product',
      };
    }

    return { passed: true, reason: '' };
  } catch (error) {
    return {
      passed: false,
      uncertain: true,
      reason: `Vision verification failed to execute: ${error.message}`,
    };
  }
};

/**
 * Aggregated Offer Validation Pipeline
 * Runs all 4 independent checks, aggregates status, records audit log in AdminReviewLog.
 *
 * @param {string|import('mongoose').Types.ObjectId} offerId
 * @returns {Promise<object>}
 */
export const runOfferValidation = async (offerId) => {
  const offer = await Offer.findById(offerId).populate('vendorId');
  if (!offer) {
    throw new Error(`Offer with ID ${offerId} not found`);
  }

  // Kill Switch: VALIDATION_MODE === 'manual'
  if ((process.env.VALIDATION_MODE || 'auto').toLowerCase() === 'manual') {
    offer.status = 'flagged_for_review';
    offer.rejectionReason = [];
    await offer.save();

    await AdminReviewLog.create({
      offerId: offer._id,
      checkedBy: 'system',
      checksPerformed: {
        locationValid: false,
        dateValid: false,
        textValid: false,
        imageValid: false,
      },
      decision: 'flagged_for_review',
      reason:
        'Validation pipeline bypassed: VALIDATION_MODE is set to manual review',
      timestamp: new Date(),
    });

    return {
      offerId: offer._id.toString(),
      status: offer.status,
      decision: 'flagged_for_review',
      checksPerformed: {
        locationValid: false,
        dateValid: false,
        textValid: false,
        imageValid: false,
      },
      rejectionReason: [],
    };
  }

  // Run all 4 checks
  const vendor = offer.vendorId || (await Vendor.findById(offer.vendorId));
  const [locationResult, textResult, imageResult] = await Promise.all([
    checkLocation(vendor),
    checkText(offer),
    checkImages(offer),
  ]);
  const dateResult = checkDates(offer);

  const checksPerformed = {
    locationValid: Boolean(locationResult.passed),
    dateValid: Boolean(dateResult.passed),
    textValid: Boolean(textResult.passed),
    imageValid: Boolean(imageResult.passed),
  };

  // Collect explicit failures (passed === false and not uncertain)
  const explicitFailures = [];
  if (!locationResult.passed && !locationResult.uncertain) {
    explicitFailures.push(
      locationResult.reason || "Shop coordinates don't match the declared city"
    );
  }
  if (!dateResult.passed && !dateResult.uncertain) {
    explicitFailures.push(dateResult.reason || 'Invalid offer dates');
  }
  if (!textResult.passed && !textResult.uncertain) {
    explicitFailures.push(textResult.reason || 'Offer text validation failed');
  }
  if (!imageResult.passed && !imageResult.uncertain) {
    explicitFailures.push(
      imageResult.reason || 'Offer image validation failed'
    );
  }

  // Collect uncertain / unparseable reasons
  const uncertainReasons = [];
  if (locationResult.uncertain) uncertainReasons.push(locationResult.reason);
  if (dateResult.uncertain) uncertainReasons.push(dateResult.reason);
  if (textResult.uncertain) uncertainReasons.push(textResult.reason);
  if (imageResult.uncertain) uncertainReasons.push(imageResult.reason);

  // Aggregation Decision:
  // 1. Any explicit failure -> rejected (all failure reasons written to offer.rejectionReason)
  // 2. Any uncertain/unparseable result -> flagged_for_review
  // 3. All four pass -> approved
  let decision = 'approved';
  let logReason = 'All automated validation checks passed';

  if (explicitFailures.length > 0) {
    decision = 'rejected';
    offer.status = 'rejected';
    offer.rejectionReason = explicitFailures;
    logReason = explicitFailures.join('; ');
  } else if (uncertainReasons.length > 0) {
    decision = 'flagged_for_review';
    offer.status = 'flagged_for_review';
    offer.rejectionReason = [];
    logReason = uncertainReasons.join('; ');
  } else {
    decision = 'approved';
    offer.status = 'approved';
    offer.rejectionReason = [];
  }

  await offer.save();

  // Audit trail entry in AdminReviewLog
  await AdminReviewLog.create({
    offerId: offer._id,
    checkedBy: 'system',
    checksPerformed,
    decision,
    reason: logReason,
    timestamp: new Date(),
  });

  return {
    offerId: offer._id.toString(),
    status: offer.status,
    decision,
    checksPerformed,
    rejectionReason: offer.rejectionReason,
  };
};

export default {
  checkLocation,
  checkDates,
  checkText,
  checkImages,
  runOfferValidation,
  isFuzzyCityMatch,
  haversineDistanceKm,
  levenshteinDistance,
};

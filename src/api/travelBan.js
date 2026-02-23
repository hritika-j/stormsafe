// Travel Ban API integration
// Manages travel ban information

// Cache storage
let cachedTravelBan = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch NYC travel ban information from Emergency Management alerts
 * Returns cached result if available and fresh (within 10 minutes)
 * TODO: replace with working travel ban data source post-MVP
 * @returns {Promise<Object>} Travel ban object with structure:
 *   { ban_level, plain_english, affects_walking, affects_subway, affects_rideshare }
 */
export async function fetchTravelBan() {
  // Check if cache is still valid
  if (cachedTravelBan && cacheTimestamp) {
    const now = Date.now();
    if (now - cacheTimestamp < CACHE_DURATION_MS) {
      console.log('Returning cached travel ban data');
      return cachedTravelBan;
    }
  }

  // Return safe default for now
  const banData = getDefaultTravelBan();

  // Cache the result
  cachedTravelBan = banData;
  cacheTimestamp = Date.now();

  return banData;
}

/**
 * Parse HTML content to detect travel ban level and affected modes
 * @param {string} html - HTML content from NYC EM website
 * @returns {Object} Parsed travel ban object
 */
function parseTravelBanHTML(html) {
  const lowerHtml = html.toLowerCase();

  // Keywords to detect ban levels
  const transitSuspendedKeywords = [
    'transit suspended',
    'subway suspended',
    'mta suspended',
  ];
  const vehicleBanKeywords = [
    'vehicle ban',
    'no private vehicles',
    'no cars allowed',
  ];
  const advisoryKeywords = ['travel advisory', 'travel strongly discouraged'];

  let banLevel = 'none';
  let plainEnglish = null;
  let affectsWalking = false;
  let affectsSubway = false;
  let affectsRideshare = false;

  // Check for transit suspension (highest severity)
  if (transitSuspendedKeywords.some((kw) => lowerHtml.includes(kw))) {
    banLevel = 'transit_suspended';
    plainEnglish = 'NYC Transit (MTA) services are suspended';
    affectsSubway = true;
    affectsRideshare = true;
    affectsWalking = false;
  }
  // Check for vehicle ban
  else if (vehicleBanKeywords.some((kw) => lowerHtml.includes(kw))) {
    banLevel = 'vehicle_ban';
    plainEnglish = 'All private vehicles banned from NYC streets';
    affectsRideshare = true;
    affectsWalking = false;
    affectsSubway = false;
  }
  // Check for advisory
  else if (advisoryKeywords.some((kw) => lowerHtml.includes(kw))) {
    banLevel = 'advisory';
    plainEnglish =
      'Travel is strongly discouraged; only travel if absolutely necessary';
    affectsWalking = true;
    affectsSubway = false;
    affectsRideshare = false;
  }

  return {
    ban_level: banLevel,
    plain_english: plainEnglish,
    affects_walking: affectsWalking,
    affects_subway: affectsSubway,
    affects_rideshare: affectsRideshare,
  };
}

/**
 * Return default "no ban" object
 */
function getDefaultTravelBan() {
  return {
    ban_level: 'none',
    plain_english: null,
    affects_walking: false,
    affects_subway: false,
    affects_rideshare: false,
  };
}

export async function getTravelBans(location) {
  try {
    // Placeholder for travel ban data
    // This would typically fetch from a local database or external API
    return {
      location,
      bans: [],
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Travel ban error:', error);
    return null;
  }
}

export function isTravelBanned(location) {
  // Check if a location has active travel bans
  return false;
}

export function getTravelBanReason(location) {
  // Get the reason for travel ban
  return null;
}

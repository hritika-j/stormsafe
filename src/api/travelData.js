// Travel Data API

/**
 * Fetch travel data from origin to destination with weather adjustments.
 * @param {Object} originCoords     - { lat, lng } of starting point
 * @param {string} destination      - Destination address/place name (used only if destCoordsHint is absent)
 * @param {string} weatherSeverity  - Weather severity: none, light, moderate, severe, extreme
 * @param {Object|null} destCoordsHint - { lat, lng } already known from SearchBox; skips geocoding when provided
 */
export async function fetchTravelData(originCoords, destination, weatherSeverity = 'none', destCoordsHint = null) {
  const mapboxKey = import.meta.env.VITE_MAPBOX_TOKEN;

  if (!mapboxKey) {
    console.warn('Mapbox API key not configured');
    return null;
  }

  try {
    // Use the coords from SearchBox if available — avoids re-geocoding a short label
    // that could resolve to a wrong city (the most common cause of huge minute values)
    const destCoords = destCoordsHint ?? await geocodeDestination(destination, mapboxKey);
    if (!destCoords) {
      console.warn('Failed to resolve destination coords:', destination);
      return null;
    }

    // Get walking directions with steps so we can build a real route description
    const directionsData = await getDirections(originCoords, destCoords, mapboxKey);
    if (!directionsData) {
      console.warn('Failed to get directions');
      return null;
    }

    // All available routes involve a ferry — return a ferry-only flag
    if (directionsData.ferryOnly) {
      return {
        baseline_minutes: null,
        storm_minutes: null,
        distance_miles: null,
        distance_category: 'unknown',
        best_route: null,
        ferry_only_route: true,
        relevantLines: [],
        route_steps: [],
      };
    }

    // Mapbox returns duration in seconds — divide by 60 for minutes
    const baselineMinutes = Math.round(directionsData.duration / 60);
    console.log(
      'Directions raw duration (seconds):', directionsData.duration,
      '→ baseline_minutes:', baselineMinutes
    );

    const stormMultiplier = getStormMultiplier(weatherSeverity);
    const stormMinutes = Math.round(baselineMinutes * stormMultiplier);
    const distanceMiles = Math.round(directionsData.distance * 0.000621371 * 10) / 10;
    const distanceCategory = getDistanceCategory(distanceMiles);

    // Build a step-based route description from real Mapbox instructions
    const routeDescription =
      generateStepBasedRoute(directionsData.steps, baselineMinutes) ||
      generateFallbackRoute(distanceCategory, weatherSeverity);

    // Extract any subway line identifiers mentioned in the steps
    const relevantLines = extractRelevantLines(directionsData.steps);
    console.log('[StormSafe] relevantLines extracted:', relevantLines);

    return {
      baseline_minutes: baselineMinutes,
      storm_minutes: stormMinutes,
      distance_miles: distanceMiles,
      distance_category: distanceCategory,
      best_route: routeDescription,
      ferry_only_route: false,
      relevantLines,
      // Include raw steps so Claude can reference actual street names
      route_steps: (directionsData.steps || []).slice(0, 6).map(s => ({
        instruction: s.maneuver?.instruction ?? null,
        street: s.name ?? null,
        duration_sec: Math.round(s.duration ?? 0),
      })),
    };
  } catch (error) {
    console.error('Travel data fetch error:', error);
    return null;
  }
}

/**
 * Geocode destination address to coordinates.
 * Only called when destCoordsHint is not provided.
 */
async function geocodeDestination(destination, mapboxKey) {
  try {
    const encodedDest = encodeURIComponent(destination);
    // Bias results strongly toward NYC to avoid resolving to wrong cities
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedDest}.json?proximity=-74.006,40.7128&country=US&access_token=${mapboxKey}`
    );

    if (!response.ok) {
      console.warn('Geocoding failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      console.warn('No geocoding results found');
      return null;
    }

    const [lng, lat] = data.features[0].geometry.coordinates;
    return { lat, lng };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Returns true if any step in the route involves ferry/boat/water transport.
 */
function isFerryRoute(steps) {
  const FERRY_KEYWORDS = ['ferry', 'boat', 'water taxi', 'water shuttle'];
  return steps.some((s) => {
    const instruction = s.maneuver?.instruction?.toLowerCase() ?? '';
    const mode = s.mode?.toLowerCase() ?? '';
    return (
      mode === 'ferry' ||
      FERRY_KEYWORDS.some((kw) => instruction.includes(kw))
    );
  });
}

/**
 * Extract NYC subway line identifiers from step instructions.
 * Looks for patterns like "the A train", "A/C/E", or step.mode === 'transit'.
 */
function extractRelevantLines(steps) {
  const VALID_LINES = new Set(['A','C','E','B','D','F','M','N','Q','R','W','1','2','3','4','5','6','7','G','J','L','S']);
  const found = new Set();

  for (const step of steps) {
    // If Mapbox marks a step as transit, try to pull the line from the instruction
    if (step.mode === 'transit' || step.maneuver?.instruction) {
      const instr = step.maneuver?.instruction ?? '';
      // Match "the A train", "the A/C/E train", "Take the 6", etc.
      const matches = instr.matchAll(/\bthe\s+([ACEDGFJLMNQRSW1-7](?:\/[ACEDGFJLMNQRSW1-7])*)\s*(?:train|line)?\b/gi);
      for (const m of matches) {
        for (const part of m[1].toUpperCase().split('/')) {
          if (VALID_LINES.has(part)) found.add(part);
        }
      }
    }
  }

  return Array.from(found);
}

/**
 * Get walking directions between two coordinates.
 * Uses the walking profile so step instructions are pedestrian-relevant.
 * Fetches alternatives so we can avoid ferry-only routes.
 */
async function getDirections(originCoords, destCoords, mapboxKey) {
  try {
    const { lng: originLng, lat: originLat } = originCoords;
    const { lng: destLng, lat: destLat } = destCoords;

    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${originLng},${originLat};${destLng},${destLat}?steps=true&alternatives=true&access_token=${mapboxKey}`
    );

    if (!response.ok) {
      console.warn('Directions API failed:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[Mapbox] raw routes count:', data.routes?.length);
    console.log('[Mapbox] route[0] duration (s):', data.routes?.[0]?.duration, '| distance (m):', data.routes?.[0]?.distance);
    console.log('[Mapbox] route[0] step count:', data.routes?.[0]?.legs?.[0]?.steps?.length);

    if (!data.routes || data.routes.length === 0) {
      console.warn('No route found');
      return null;
    }

    // Pick the first route that doesn't involve a ferry
    const nonFerryRoutes = data.routes.filter((r) => {
      const steps = r.legs?.[0]?.steps ?? [];
      return !isFerryRoute(steps);
    });

    if (nonFerryRoutes.length === 0) {
      // Every alternative involves a ferry — flag it
      console.warn('[StormSafe] All routes are ferry-based — flagging ferry_only_route');
      return { ferryOnly: true };
    }

    const route = nonFerryRoutes[0];
    // Steps live inside route.legs[0].steps for Mapbox Directions v5
    const steps = route.legs?.[0]?.steps ?? [];

    return {
      duration: route.duration,   // seconds
      distance: route.distance,   // meters
      steps,
      ferryOnly: false,
    };
  } catch (error) {
    console.error('Directions API error:', error);
    return null;
  }
}

/**
 * Build a one-sentence route description from real Mapbox step instructions.
 * Returns null if steps are absent or uninformative (caller falls back to generic).
 */
function generateStepBasedRoute(steps, totalMinutes) {
  if (!steps || steps.length === 0) return null;

  // Filter out arrive step and any steps involving non-subway transport modes
  const EXCLUDED_MODES = ['bus', 'ferry', 'boat', 'water taxi'];
  const moveSteps = steps.filter(
    s => s.maneuver?.type !== 'arrive' &&
         s.maneuver?.instruction &&
         !EXCLUDED_MODES.some(mode => s.maneuver.instruction.toLowerCase().includes(mode))
  );
  if (moveSteps.length === 0) return null;

  const firstInstruction = moveSteps[0].maneuver.instruction;

  if (moveSteps.length === 1) {
    return `${firstInstruction} — about ${totalMinutes} min`;
  }

  // For multi-step routes: first instruction + final turn + total time
  const lastMove = moveSteps[moveSteps.length - 1];
  const lastInstruction = lastMove.maneuver.instruction.toLowerCase();
  return `${firstInstruction}, then ${lastInstruction} — about ${totalMinutes} min`;
}

/**
 * Generic fallback route description when no step data is available.
 */
function generateFallbackRoute(distanceCategory, weatherSeverity) {
  if (distanceCategory === 'walkable') {
    if (weatherSeverity === 'extreme') return 'Within walking distance — take shelter or use transit given the weather.';
    if (weatherSeverity === 'severe') return 'Within walking distance — bundle up, conditions are rough.';
    return 'Walking distance — straightforward if weather allows.';
  }
  if (distanceCategory === 'short_transit') {
    if (weatherSeverity === 'extreme') return 'Take the subway to avoid street exposure.';
    return 'A quick subway or bus ride — stay underground as much as possible.';
  }
  if (weatherSeverity === 'extreme') return 'Take the subway or rideshare — avoid prolonged outdoor exposure.';
  if (weatherSeverity === 'severe') return 'Subway preferred over street-level routes.';
  return 'Take the subway when available to limit weather exposure.';
}

function getStormMultiplier(weatherSeverity) {
  const multipliers = {
    none: 1.0,
    light: 1.3,
    moderate: 1.7,
    severe: 2.2,
    extreme: 3.0,
  };
  return multipliers[weatherSeverity] || 1.0;
}

function getDistanceCategory(distanceMiles) {
  if (distanceMiles < 0.8) return 'walkable';
  if (distanceMiles < 3) return 'short_transit';
  return 'long_transit';
}

export async function getTravelData(_startLocation, _endLocation) {
  try {
    return { routes: [], recommendations: [] };
  } catch (error) {
    console.error('Travel data error:', error);
    return null;
  }
}

export async function getRouteAlternatives(_startLocation, _endLocation) {
  try {
    return [];
  } catch (error) {
    console.error('Route alternatives error:', error);
    return [];
  }
}

export async function estimateTravelTime(_startLocation, _endLocation, _weatherData) {
  try {
    return { normalTime: 0, estimatedTime: 0, delay: 0 };
  } catch (error) {
    console.error('Travel time error:', error);
    return null;
  }
}

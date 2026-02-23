// transitStatus.js (REPLACE ENTIRE FILE WITH THIS)
// Fetches transit system status (MTA subway alerts JSON + PATH)

//
// NOTE:
// - MTA alerts are fetched from YOUR server endpoint: GET /api/mta-alerts
// - That endpoint returns JSON (not protobuf), so we do NOT use gtfs-realtime-bindings.
// - No MTA API key is needed in the browser.
//

/**
 * Fetch PATH (Port Authority Trans-Hudson) transit status
 * @returns {Promise<Object>} PATH status with { status, message }
 */
async function fetchPATHStatus() {
  try {
    const response = await fetch("/api/path/bin/portauthority/ridepath.json");

    if (!response.ok) {
      console.warn("Failed to fetch PATH status:", response.status);
      return { status: "normal", message: null };
    }

    const data = await response.json();

    // Parse results array for delays
    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results) {
        if (result.destinations && Array.isArray(result.destinations)) {
          for (const destination of result.destinations) {
            if (destination.messages && Array.isArray(destination.messages)) {
              for (const msg of destination.messages) {
                if (
                  msg.arrivalTimeMessage &&
                  msg.arrivalTimeMessage.includes("Delayed")
                ) {
                  return {
                    status: "delays",
                    message: "Delays on PATH — next train delayed",
                  };
                }
                if (msg.secondsToArrival && msg.secondsToArrival > 1200) {
                  const minutes = Math.round(msg.secondsToArrival / 60);
                  return {
                    status: "delays",
                    message: `Delays on PATH — next train ${minutes} min`,
                  };
                }
              }
            }
          }
        }
      }
    }

    return { status: "normal", message: null };
  } catch (error) {
    console.error("PATH status fetch error:", error);
    return { status: "normal", message: null };
  }
}

/**
 * Fetch MTA subway alerts from your server endpoint (JSON)
 * @returns {Promise<Object|null>} JSON payload or null
 */
async function fetchMtaAlertsJson() {
  try {
    const res = await fetch("/api/mta-alerts");
    if (!res.ok) {
      console.warn("Failed to fetch MTA alerts:", res.status);
      return null;
    }
    const data = await res.json();
    console.log('[MTA] First 3 entities from feed:', JSON.stringify(data?.entity?.slice(0, 3), null, 2));
    return data;
  } catch (e) {
    console.error("MTA alerts fetch error:", e);
    return null;
  }
}

/**
 * Extract a readable alert message from various possible MTA JSON shapes.
 * We keep this defensive because feed formats can vary.
 */
function pickAlertText(alert) {
  // Common shapes we might encounter
  if (typeof alert === "string") return alert;

  // If alert has a "header_text" or "description_text" like GTFS-RT JSON conversion
  const header =
    alert?.header_text?.translation?.[0]?.text ||
    alert?.header_text?.[0]?.text ||
    alert?.header_text?.text;

  const desc =
    alert?.description_text?.translation?.[0]?.text ||
    alert?.description_text?.[0]?.text ||
    alert?.description_text?.text;

  // Prefer header_text — it's the short, human-readable line displayed in MTA apps
  return header || desc || null;
}

/**
 * Extract affected route ids from alert if present.
 */
function pickRoutes(alert) {
  // GTFS-RT style: informed_entity array
  const routes = [];
  const entities = alert?.informed_entity;
  if (Array.isArray(entities)) {
    for (const ent of entities) {
      if (ent?.route_id) routes.push(ent.route_id);
    }
  }

  // Sometimes route ids appear elsewhere; keep minimal.
  return routes;
}

/**
 * Map alert effect to severity buckets.
 * Keep conservative defaults.
 */
function mapSeverity(alert) {
  const effect = alert?.effect;
  if (!effect) return "none";

  const effectMap = {
    NO_SERVICE: "extreme",
    REDUCED_SERVICE: "high",
    SIGNIFICANT_DELAYS: "high",
    DETOUR: "moderate",
    OTHER_EFFECT: "moderate",
    UNKNOWN_EFFECT: "moderate",
    STOP_MOVED: "low",
  };

  return effectMap[effect] || "moderate";
}

/**
 * Initialize common subway lines with normal status.
 */
function initSubwayStatus() {
  const subwayStatus = {};
  const commonLines = [
    "A",
    "C",
    "E",
    "B",
    "D",
    "F",
    "M",
    "N",
    "Q",
    "R",
    "W",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "G",
    "J",
    "L",
    "S",
  ];

  commonLines.forEach((line) => {
    subwayStatus[line] = { status: "normal", message: null };
  });

  return subwayStatus;
}

/**
 * Process MTA alerts JSON into our internal status shape.
 * @param {Object|null} mtaJson
 * @param {Array<string>} routeIds
 */
function processMtaJson(mtaJson, routeIds = []) {
  const subwayStatus = initSubwayStatus();
  let maxSeverity = "none";

  if (!mtaJson) {
    return { subwayStatus, maxSeverity };
  }

  // Feed could contain: { entity: [ { alert: {...} } ] } (GTFS-RT-ish)
  const entities = mtaJson?.entity;
  console.log('Processing MTA entities:', entities?.length);
  if (!Array.isArray(entities)) {
    return { subwayStatus, maxSeverity };
  }

  for (const entity of entities) {
    const alert = entity?.alert;
    if (!alert) continue;

    const affectedRoutes = pickRoutes(alert);

    // Filter by requested routeIds if provided
    if (routeIds.length > 0) {
      const hasRequested = affectedRoutes.some((r) => routeIds.includes(r));
      if (!hasRequested) continue;
    }

    const severity = mapSeverity(alert);
    if (severity !== "none") maxSeverity = severity;

    const message = pickAlertText(alert);

    // Apply message to affected routes we know.
    // Mark as "delays" if there is ANY message — don't gate on effect type.
    for (const routeId of affectedRoutes) {
      console.log('Alert found:', routeId, alert?.effect, pickAlertText(alert));
      if (subwayStatus[routeId]) {
        subwayStatus[routeId] = {
          status: message ? "delays" : "normal",
          message: message,
        };
      }
    }
  }

  return { subwayStatus, maxSeverity };
}

/**
 * Generate a summary of transit status
 */
function generateSummary(subwayStatus, pathStatus) {
  const delayedLines = Object.entries(subwayStatus)
    .filter(([_, status]) => Boolean(status.message))
    .map(([line]) => line);

  if (delayedLines.length === 0 && !pathStatus?.message) {
    return "Good service on all lines";
  }

  if (delayedLines.length > 0 && !pathStatus?.message) {
    return `Delays on ${delayedLines.join(", ")}`;
  }

  if (delayedLines.length === 0 && pathStatus?.message) {
    return "PATH service affected";
  }

  return `Delays on ${delayedLines.join(", ")} and PATH`;
}

/**
 * Default transit status (safe fallback)
 */
function getDefaultTransitStatus() {
  const subwayStatus = initSubwayStatus();
  return {
    subway: subwayStatus,
    path: { status: "normal", message: null },
    summary: "Good service on all lines",
    severity: "none",
  };
}

const NJ_KEYWORDS = [
  "new jersey",
  "nj",
  "jersey city",
  "hoboken",
  "newark",
  "harrison",
  "journal square",
  "grove street",
  "exchange place",
  "newport",
  "secaucus",
  "bayonne",
  "weehawken",
  "edgewater",
  "fort lee",
  "union city",
];

/**
 * Returns true only when the trip involves New Jersey.
 * @param {string|null} origin
 * @param {string|null} destination
 * @returns {boolean}
 */
function isPathRelevant(origin, destination) {
  const haystack = `${origin || ""} ${destination || ""}`.toLowerCase();
  return NJ_KEYWORDS.some((kw) => haystack.includes(kw));
}

/**
 * Fetch transit status (MTA + PATH) and merge results.
 * @param {Array<string>} routeIds - optional filter (e.g., ['A','L'])
 * @param {string|null} origin - trip origin address/location
 * @param {string|null} destination - trip destination address/location
 */
export async function fetchTransitStatus(routeIds = [], origin = null, destination = null) {
  try {
    const pathNeeded = isPathRelevant(origin, destination);

    const [mtaJson, pathStatus] = await Promise.all([
      fetchMtaAlertsJson(),
      pathNeeded ? fetchPATHStatus() : Promise.resolve(null),
    ]);

    const { subwayStatus, maxSeverity } = processMtaJson(mtaJson, routeIds);

    // If routeIds specified, return only those routes (if present)
    let filteredSubway = subwayStatus;
    if (routeIds.length > 0) {
      filteredSubway = {};
      for (const id of routeIds) {
        if (subwayStatus[id]) filteredSubway[id] = subwayStatus[id];
      }
    }

    return {
      subway: filteredSubway,
      path: pathStatus,
      summary: generateSummary(subwayStatus, pathStatus),
      severity: maxSeverity,
    };
  } catch (error) {
    console.error("Transit status fetch error:", error);
    return getDefaultTransitStatus();
  }
}
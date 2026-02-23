// Claude AI Engine integration
// Leverages Anthropic's Claude for intelligent weather and travel analysis

/**
 * Extract and parse JSON from text, handling markdown code fences and extra text
 * @param {string} text - Raw response text from Claude
 * @returns {Object} Parsed JSON object
 * @throws {SyntaxError} If JSON cannot be parsed
 */
function extractJson(text) {
  let cleaned = text.trim();

  // Remove markdown code fences
  cleaned = cleaned.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '');

  // Extract JSON substring if extra text exists
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * Normalize Claude response to guaranteed schema
 * Handles common field name variations and ensures all required fields exist
 * @param {Object} parsed - Parsed recommendation from Claude
 * @returns {Object} Normalized recommendation object
 */
function normalizeRecommendation(parsed) {
  // Normalize verdict
  let verdict = parsed.verdict;
  if (!verdict) {
    // Try alternative field names
    verdict = parsed.recommendation || parsed.not_tonight || parsed.wait_it_out || 'Wait it out';
    // Handle boolean shortcuts
    if (typeof verdict === 'boolean') {
      verdict = verdict ? 'Go for it' : 'Wait it out';
    }
  }
  // Validate verdict is one of allowed values
  const allowedVerdicts = ['Go for it', 'Go if you have to', 'Wait it out', 'Stay in tonight'];
  if (!allowedVerdicts.includes(verdict)) {
    verdict = 'Wait it out'; // Default to safe option
  }

  // Normalize reasons
  let reasons = parsed.reasons;
  if (!Array.isArray(reasons)) {
    // Try alternative field names
    reasons = parsed.key_factors || parsed.risk_factors || parsed.factors || [];
    if (!Array.isArray(reasons)) {
      reasons = [];
    }
  }
  // Ensure 2-3 reasons
  if (reasons.length > 3) {
    reasons = reasons.slice(0, 3);
  }
  if (reasons.length < 2) {
    reasons.push('Unable to fully assess conditions');
  }

  // Normalize return_risk
  let return_risk = parsed.return_risk;
  if (!return_risk) {
    // Try alternative field names
    return_risk = parsed.risk_level || parsed.travel_risk || 'unknown';
  }
  // Validate return_risk is one of allowed values
  const allowedRisks = ['low', 'medium', 'high', 'unknown'];
  if (!allowedRisks.includes(return_risk)) {
    return_risk = 'unknown';
  }

  // Normalize best_route_advice
  let best_route_advice = parsed.best_route_advice;
  if (!best_route_advice) {
    // Try alternative field names
    best_route_advice = parsed.transit_advice || parsed.route_advice || null;
  }
  // Ensure it's a string or null
  if (best_route_advice && typeof best_route_advice !== 'string') {
    best_route_advice = null;
  }

  // Normalize summary
  let summary = parsed.summary;
  if (!summary) {
    // Try alternative field names
    summary = parsed.reasoning || parsed.transit_advice || parsed.explanation || 'Unable to provide summary';
  }
  if (typeof summary !== 'string') {
    summary = 'Unable to provide summary';
  }

  return {
    verdict,
    reasons: reasons.map((r) => (typeof r === 'string' ? r : String(r))),
    return_risk,
    best_route_advice,
    summary,
  };
}

/**
 * Get a recommendation from Claude on whether to travel
 * @param {Object} payload - Combined weather, transit, travel, and ban data
 * @returns {Promise<Object>} Recommendation with verdict, reasons, and advice
 */
export async function getRecommendation(payload) {
  try {
    // Build a human-readable transit summary so Claude gets clean, specific context
    const transitContext = [];
    if (payload.transit_status?.subway) {
      for (const [line, info] of Object.entries(payload.transit_status.subway)) {
        // Include any line with a message — don't gate on status field
        if (info.message) {
          transitContext.push(`${line} train: ${info.message}`);
        }
      }
    }
    if (payload.transit_status?.path?.status !== 'normal' && payload.transit_status?.path?.message) {
      transitContext.push(`PATH: ${payload.transit_status.path.message}`);
    }
    const transitSummary = transitContext.length > 0
      ? transitContext.join('. ')
      : 'All lines running normally';

    console.log('[StormSafe] transitSummary →', transitSummary);

    // Strip transit_status.subway to only lines with issues before sending to Claude.
    // Sending all 20 "normal" lines causes Claude to ignore the specific problems.
    const subwayProblems = {};

    if (payload.transit_status?.subway) {
      for (const [line, info] of Object.entries(payload.transit_status.subway)) {
        if (info.status !== 'normal' || info.message) {
          subwayProblems[line] = info;
        }
      }
    }
    const strippedTransit = {
      subway: Object.keys(subwayProblems).length > 0 ? subwayProblems : 'All lines normal',
      path: payload.transit_status?.path ?? null,
      summary: payload.transit_status?.summary ?? 'Good service on all lines',
    };

    console.log('Transit summary sent to Claude:', transitSummary);

    // Build route context note for ferry-only trips or trips with known lines
    const ferryOnly = payload.travelData?.ferry_only_route === true;
    const relevantLines = payload.travelData?.relevantLines ?? [];

    const routeContext = ferryOnly
      ? 'ROUTE CONTEXT: This trip has no subway or PATH option — do not suggest any route. Tell the user transit options are very limited for this specific trip.'
      : relevantLines.length > 0
        ? `ROUTE CONTEXT: The relevant subway lines for this trip are: ${relevantLines.join(', ')}. Only reference these specific lines in your reasons and route advice.`
        : '';

    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are StormSafe — a smart NYC friend who tells it like it is. You know when to push someone out the door and when to tell them to order in. FOMO is real. So is getting stuck in a storm at midnight. You balance both.

CRITICAL: Output ONLY raw JSON. No markdown. No code fences. No backticks. No explanation. No prose.

Your response must:
- Begin with { and end with }
- Contain absolutely NO markdown, code blocks, backticks, or any non-JSON text
- Be valid JSON parseable by JSON.parse()
- Follow this exact schema (do not add extra fields):
{
  "verdict": one of: "Go for it" | "Go if you have to" | "Wait it out" | "Stay in tonight",
  "reasons": array of 2-3 reason strings (max 3 — make every word count),
  "return_risk": one of: "low" | "medium" | "high" | "unknown",
  "best_route_advice": one sentence max — name the exact line or admit there are no good options, or null,
  "summary": one sentence with NYC energy — direct, slightly wry, never preachy
}

Verdict meanings:
- "Go for it": conditions are fine and the trip is worth it. FOMO angle — they'll regret missing this more than getting a little wet.
- "Go if you have to": rough but manageable for necessary trips. Necessity check — is this trip actually essential right now?
- "Wait it out": conditions will improve soon. Add urgency — give it an hour and they'll have a much better time.
- "Stay in tonight": genuinely bad conditions. Give them permission to cancel — honestly great night to order in, no shame.

Tone rules:
- Sound like a friend who knows NYC, not a weather robot
- Mix in necessity checks ("Is this trip actually essential?"), FOMO reality checks ("They'll understand"), and honest vibes ("The city will still be there tomorrow")
- Return trip warning with personality: "Getting there is fine. Getting home at midnight in this? That's the real gamble."
- Under 3 reasons — no padding, no hedging

Analysis rules:
- Prioritize return-trip safety over current conditions
- When transit lines on the user's route are suspended, push hard toward "Wait it out" or "Stay in tonight"
- ALWAYS name exact lines (e.g., "A train delays", "PATH suspended", "L train signal problems")
- ALWAYS quote actual delay messages from transit data — never paraphrase
- ALWAYS mention specific numbers: wind speed in mph, visibility in miles
- NEVER use generic phrases like "transit may be affected" — be specific about which lines and why
- If PATH status is not normal, mention PATH explicitly in reasons
- Be honest about risk — default to safer verdict when uncertain
- Verdict guidance: extreme/severe weather → "Stay in tonight" or "Wait it out"; rough but manageable → "Go if you have to"; clear → "Go for it"
- Only recommend subway lines and PATH. Never mention ferry, boat, water taxi, bus, or any other transport mode. If subway and PATH are not viable options for the route, say the trip has limited transit options — do not suggest alternatives like bus or ferry.
- Never suggest avoiding PATH in best_route_advice or reasons. PATH is a valid option for NJ-NY trips. Only mention it when relevant.
- Never recommend PATH if PATH shows delays over 15 minutes — acknowledge the delay and suggest subway alternatives instead.
- Never suggest walking to a subway station without knowing actual walk time. Use best_route from travel_data if available — do not invent walking alternatives.
- Only name subway lines that appear in best_route from travel_data. Do not suggest lines the user would have to go out of their way for.
- If transit options are limited or delayed, say "limited options right now" rather than suggesting something impractical.
- Keep best_route_advice to one sentence. Name the exact line or admit there are no good options. Never suggest extra walking unless walk time is explicitly under 10 minutes.
- You will receive a transitSummary field as the first line of the user message. It lists specific line delays with exact messages from MTA. If transitSummary is not "All lines running normally", you MUST include at least one reason that quotes this specific delay information. Example: "A train has signal problems at Jay St — this is your main line." Never ignore the transitSummary field.
- When transit issues exist, name the specific line and specific problem in your reasons. Example: "A train has signal delays at Jay St — your main line home." Never say vague things like "delays detected" or "some disruptions". Be specific or say nothing about transit.
- If is_walkable is true in the travel data, this is a short walking trip. Never mention subway lines, PATH, or any transit system in your response. Focus only on weather conditions and walking advice.
- For walking trips, never mention specific streets, bridges, parks, or landmarks in best_route_advice unless they are explicitly provided in the route data. Use a simple, warm line instead — e.g., "Bundle up and walk it — not far at all", "Short walk, dress for the weather and go", or "Totally walkable — just layer up". Keep it honest and light.

EXAMPLE OUTPUT (no text before or after, only this JSON):
{"verdict": "Wait it out", "reasons": ["A train: 'service changes expected' — not the night to gamble on it", "Wind 28 mph, visibility 0.5 miles — getting there is one thing, getting back is another"], "return_risk": "high", "best_route_advice": "Take the A if it's running by 10pm, otherwise call it.", "summary": "Give it an hour — conditions are improving and you'll have a much better time."}`,
        messages: [
          {
            role: 'user',
            content: `Current transit conditions on user's route: ${transitSummary}
${routeContext ? `\n${routeContext}` : ''}
LIVE TRANSIT DATA (lines with issues only — all others normal):
${JSON.stringify(strippedTransit, null, 2)}

FULL TRAVEL CONTEXT:
${JSON.stringify(payload, null, 2)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Claude API error: ${response.status} ${response.statusText}`,
        errorBody
      );
      return getDefaultRecommendation();
    }

    const data = await response.json();
    const responseText = data.content[0].text;

    // Extract and parse JSON response
    try {
      const parsed = extractJson(responseText);
      const normalized = normalizeRecommendation(parsed);
      return normalized;
    } catch (parseError) {
      console.error(
        'Failed to parse/normalize Claude response:',
        parseError.message,
        'Raw response:',
        responseText
      );
      return getDefaultRecommendation();
    }
  } catch (error) {
    console.error('Claude recommendation request failed:', error.message);
    return getDefaultRecommendation();
  }
}

/**
 * Return default safe recommendation
 */
function getDefaultRecommendation() {
  return {
    verdict: 'Wait it out',
    reasons: ['Unable to assess conditions — consider waiting'],
    return_risk: 'high',
    best_route_advice: 'Stay home or postpone your trip until conditions improve.',
    summary: 'Travel is not recommended at this time.',
  };
}

export async function analyzeWeatherConditions(weatherData) {
  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Analyze the following weather data and provide a brief assessment of travel safety:\n${JSON.stringify(weatherData)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Claude API error in analyzeWeatherConditions: ${response.status} ${response.statusText}`,
        errorBody
      );
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Claude analysis error:', error.message);
    return null;
  }
}

export async function generateTravelRecommendations(weatherData, transitData, travelData) {
  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Based on the weather, transit, and travel data provided, give practical travel recommendations:\nWeather: ${JSON.stringify(weatherData)}\nTransit: ${JSON.stringify(transitData)}\nTravel: ${JSON.stringify(travelData)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Claude API error in generateTravelRecommendations: ${response.status} ${response.statusText}`,
        errorBody
      );
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Claude recommendations error:', error.message);
    return null;
  }
}

export async function getStormSafety(weatherData) {
  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Given this weather data, is it safe to travel? Provide a single word verdict (Safe/Caution/Unsafe) followed by a brief explanation:\n${JSON.stringify(weatherData)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Claude API error in getStormSafety: ${response.status} ${response.statusText}`,
        errorBody
      );
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Claude safety check error:', error.message);
    return null;
  }
}

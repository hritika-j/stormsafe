# StormSafe

**Should you step out? StormSafe decides for you.**

New Yorkers don't stay home. A little snow, some wind, delayed trains ,one of it is supposed to stop you. But sometimes you're standing at the door at 10pm wondering if the trip across town is actually worth it, and you just need someone to tell you straight.

That's StormSafe. It combines real-time weather, live MTA alerts, and AI reasoning to make the call for you — and tell you exactly why.

---

## What it does

Enter where you're coming from and where you're headed. StormSafe pulls live weather conditions, checks MTA subway alerts for your specific lines, calculates how much longer your trip will take in the storm, and asks Claude to make a call:

- **Go for it** — conditions are fine, don't overthink it
- **Go if you have to** — manageable, but is this trip actually essential?
- **Wait it out** — give it an hour and you'll have a better time
- **Stay in tonight** — honestly great night to order in

The result includes specific reasons (not generic weather warnings), a normal vs. storm travel time comparison, return trip risk, and a plain-English verdict with some NYC personality.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Routing & geocoding | Mapbox Directions + Search API |
| Weather | OpenWeatherMap API |
| Transit | MTA real-time alerts (JSON feed) + PATH status |
| AI reasoning | Anthropic Claude (claude-sonnet-4) |
| Deployment | Vercel |

---

## Interesting technical decision: the MTA alert pipeline

Getting real, specific subway delay information into Claude's reasoning was harder than expected.

The MTA publishes real-time alerts via a GTFS-RT protobuf feed — but parsing binary protobuf in a lightweight Node server adds significant complexity. Instead, StormSafe uses MTA's public JSON alerts endpoint, which returns the same data in a much friendlier format with no API key required.

The challenge was that the JSON feed returns ~200 alerts at any given time covering every line, every planned outage, and every service change across the entire system. Passing all of that to Claude would be noise. So the pipeline works in three steps:

1. **Filter by route** — only keep alerts where `informed_entity[].route_id` matches the lines relevant to the user's trip (extracted from the Mapbox directions response)
2. **Extract the human-readable message** — pull `header_text.translation[0].text`, which is the plain English alert like *"[4] trains are running with delays in both directions"*
3. **Inject as structured context** — build a `transitSummary` string and pass it directly into Claude's prompt so it can reference the specific line and specific problem in its reasoning

The result is Claude saying *"4 train has delays in both directions due to the winter storm — your main line home"* instead of the generic *"check for real-time updates."*

One gotcha: the MTA feed often returns `undefined` for the `effect` field on storm-related alerts (instead of `SIGNIFICANT_DELAYS` or `REDUCED_SERVICE`). Early versions of the pipeline filtered on effect type and silently dropped everything. The fix was to include any alert with a non-empty `header_text`, regardless of effect value.

---

## Running locally

```bash
# Install dependencies
npm install

# Add environment variables
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, VITE_MAPBOX_TOKEN, VITE_OPENWEATHER_KEY

# Run dev (frontend + backend concurrently)
npm run dev:all
```

Frontend runs on `localhost:5173`, backend on `localhost:3001`. Vite proxies `/api/*` to the Express server in development.

---

## Notes

- Only works for NYC and NJ locations — validates coordinates against the greater NYC bounding box
- Ferry and bus routes are intentionally excluded — subway and PATH only
- PATH status only appears when the trip involves a New Jersey location
- Walkable trips (under 20 min) skip transit info entirely

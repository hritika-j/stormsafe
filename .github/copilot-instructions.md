# Stormsafe Project

A React app with Tailwind CSS to provide weather alerts, travel bans, and transit status information.

## Setup Steps
- [x] Project scaffolded with Vite + React
- [x] Tailwind CSS configured
- [x] Project structure created
- [x] API files created
- [x] Components created
- [x] Environment variables configured
- [ ] Dependencies installed
- [ ] Development server running

## Project Files Created
- `package.json` - Project dependencies and scripts
- `vite.config.js` - Vite configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `index.html` - HTML entry point
- `src/main.jsx` - React entry point
- `src/App.jsx` - Main App component
- `src/index.css` - Global styles with Tailwind imports
- `.env` - Environment variables (empty, needs to be filled)
- `.eslintrc.cjs` - ESLint configuration
- `.gitignore` - Git ignore rules
- `README.md` - Project documentation

## API Files
- `src/api/weather.js` - OpenWeather API integration
- `src/api/travelBan.js` - Travel ban data management
- `src/api/transitStatus.js` - Transit system status (MTA)
- `src/api/travelData.js` - Travel route and timing data
- `src/api/claudeEngine.js` - Claude AI integration

## Components
- `src/components/TravelBanBanner.jsx` - Travel ban alerts
- `src/components/InputScreen.jsx` - Route input form
- `src/components/StormVerdict.jsx` - Safety verdict display
- `src/components/TransitStatusStrip.jsx` - Transit status overview
- `src/components/GearTips.jsx` - Travel gear recommendations

## Environment Variables
Required API keys to be added to `.env`:
- `VITE_REACT_APP_OPENWEATHER_KEY` - OpenWeather API key
- `VITE_REACT_APP_MAPBOX_KEY` - Mapbox API key
- `VITE_REACT_APP_MTA_KEY` - MTA API key
- `VITE_ANTHROPIC_KEY` - Anthropic API key

## Technology Stack
- React 18
- Vite
- Tailwind CSS
- Environment variables for API keys
- Claude API for AI features

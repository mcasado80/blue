# BlueCoinVerse

A universal currency converter PWA with AI-powered product price comparison across 6 countries. Search for any product and instantly see prices in CLP, USD, ARS, BRL, GBP, EUR, and BTC.

## Tech Stack

- **Frontend**: Angular 20, TypeScript 5.8
- **AI**: DeepSeek API for product price lookups
- **PWA**: Service Worker, installable on mobile/desktop
- **Deploy**: GitHub Actions + rsync to DigitalOcean

## Features

- Real-time currency conversion with rates from multiple APIs (Bluelytics, MinIndicador, fawazahmed0)
- AI-powered product search with international price comparison across 6 countries
- Bitcoin integration with automatic USD-to-BTC conversion (8-decimal precision)
- 3D flip animation between converter and search views, with swipe gesture support
- Dark/light mode with system preference detection
- i18n support: Spanish, English, Portuguese
- Offline-capable with intelligent caching and fallback rates

## Running Locally

```bash
# Install dependencies
npm install

# Create a .env file with your DeepSeek API key
echo "DEEPSEEK_API_KEY=your-key-here" > .env

# Start dev server (auto-generates environment files from .env)
npm start
```

The app runs at `http://localhost:4200`.

## Build

```bash
npm run build:prod
```

## Project Structure

```
src/app/
  components/       # Reusable UI components (toast notifications)
  services/
    exchange-rate.service.ts    # Multi-source exchange rate fetching
    product-search.service.ts   # DeepSeek AI integration
    toast.service.ts            # Notification management
    update.service.ts           # PWA update handling
  converter/        # Currency converter view
  search/           # Product search view
  app.component.ts  # Root component with flip navigation
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DEEPSEEK_API_KEY` | API key for DeepSeek chat completions |

Environment files (`src/environments/`) are auto-generated from `.env` via `scripts/set-env.js` and are gitignored.

## License

MIT - Martin Casado

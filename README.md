# API Inspector Mobile

A full-stack API and WebSocket inspector built with Expo, React Native, TypeScript, Expo Router, Express, and PostgreSQL.

## Features

- Compose HTTP requests with methods, headers, query parameters, and request bodies.
- Import and export cURL commands and interpolate saved environment variables.
- Inspect status, response headers, JSON bodies, duration, and payload size.
- Search execution history, save requests, and compare saved JSON responses.
- Connect to a WebSocket and inspect incoming payloads in real time.
- Persist collections, saved requests, execution history, and environment variables in PostgreSQL.

## Run locally

```bash
npm install
Copy-Item .env.example .env
```

Set a private `POSTGRES_PASSWORD` in `.env`, then start PostgreSQL and the API in separate terminals:

```bash
docker compose up -d postgres
npm --prefix server install
npm --prefix server run dev
```

In another terminal, start the mobile app:

```bash
npx expo start
```

The default `EXPO_PUBLIC_API_URL` works for a browser or emulator on the same
computer. For Expo Go on a physical phone, change it in `.env` to your computer's
LAN IP address (for example, `http://192.168.1.25:4000`) and ensure the phone and
computer are on the same network. Reload Expo after changing the value.

The API applies `server/src/db/schema.sql` at startup. Set `CORS_ORIGIN` to a
comma-separated allowlist when exposing the API beyond local development.

## Validate

```bash
npx tsc --noEmit
npm run lint
npm test
npm --prefix server run typecheck
npm --prefix server test
```

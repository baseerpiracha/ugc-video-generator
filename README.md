# UGC Video Generator

A lightweight Next.js app that turns a product URL into a short UGC-style video using a local asset library and deterministic video rendering.

## What it does

1. Detects a product URL in a chat message.
2. Fetches public page metadata when available.
3. Infers product name, category, audience, and value proposition.
4. Builds a short creative brief with script and asset selections.
5. Renders a vertical 9:16 MP4 using local background footage, a reaction GIF, text overlays, and audio.
6. Returns the final video directly in the chat thread.

## Architecture

- Frontend: Next.js App Router + TypeScript + Tailwind
- Backend: API routes in App Router
- Analysis: URL extraction and content inspection using Cheerio
- Creative direction: structured product insight + asset selection logic
- Rendering: FFmpeg via ffmpeg-static

## Local setup

```bash
npm install
npm run dev
```

- Open http://localhost:3003
- Link:https://ugc-video-generator-pi.vercel.app/

## Required environment variables

This MVP uses no external API keys by default. The app can run without any secret configuration. If you add a real LLM in the future, add it through environment variables such as:

```bash
OPENAI_API_KEY=your_key_here
```

## How video rendering works

The app picks a background video, a reaction GIF, and an audio track from the local assets folder. It then creates a short 1080x1920 MP4 with text overlays and a prominent GIF. The final file is served from the public/generated directory.

## Deployment notes

Deploy the app to a public Next.js host with Node support and keep the generated folder accessible. The app is intentionally simple and requires no database, auth, or payment flows.

## Known limitations

- The site scraping is intentionally lightweight and may fail on highly protected pages.
- The asset library is curated and local rather than a large content marketplace.
- This is a deterministic MVP designed for reliability rather than cinematic complexity.

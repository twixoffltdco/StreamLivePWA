StreamLiveAPP — multi-mirror aggregation patch
==============================================

This is an overlay patch for the existing public repository:
https://github.com/twixoffltdco/StreamLiveAPP

It is NOT a complete standalone project. Extract these files into the root of your existing StreamLiveAPP checkout, allowing them to overwrite matching files, then run your normal build/deploy.

Files included:
- lib/fetcher.ts       — collect channel/video links from all three mirrors; parse each card from its own mirror; round-robin new cards across sources; keep same-content cards from different domains as separate entries.
- lib/forum.ts         — aggregate forum categories from all mirrors; scope category/thread IDs by source to prevent same numeric IDs from opening the wrong mirror; preserve source URLs for posts and images.
- lib/types.ts         — forum list types include per-entry source and mixed-source state.
- app/forum/page.tsx   — displays categories from all mirrors and identifies the source on each card.

Required source configuration remains the existing lib/config.ts:
- prod: https://streamlivetv.freedev.app
- reserve: https://domtv.blyz.ru
- mirror3: https://streamliveru.web1337.net

Build/deploy:
  npm install
  npm run build

Important behavior:
- A card is fetched from the exact mirror URL it came from; the scraper no longer silently reads production metadata for a reserve/mirror3 card.
- Same channel/video/forum category on different domains remains duplicated by design.
- If a source is unavailable, its previously archived cards remain available. New cards from a mirror that is inaccessible cannot be discovered until that mirror responds.
- Forum category links use source-scoped IDs such as /forum/c/prod-12 and /forum/c/reserve-12 so a category with the same numeric ID on another mirror cannot be confused with it.

# MOBILE_TEXT_OVERFLOW_FIX_PLAN

## Summary

Fix vertical/mobile text overflow on `https://hypnochunk.com/` by making all user/content-generated titles and subtitle lines wrap or clamp inside the 520px mobile shell instead of extending past the viewport.

## Key Changes

1. `web/components/AudioPlayer.tsx`
   - Replace single-line truncation for current track title with mobile-safe wrapping and two-line clamp behavior.
   - Keep icon actions (`History`, `Close`) shrink-safe.

2. `web/app/page.tsx`
   - Update `renderTrackCard` title area to avoid horizontal overflow for long names.
   - Keep avatar/control column fixed (`shrink-0`) and text column bounded (`min-w-0`, `max-w-full`, overflow hidden).

3. `web/components/ContinueListeningCard.tsx`
   - Make title/action layout responsive by allowing wrapping.
   - Convert title from single-line truncate to two-line clamp/wrap.
   - Keep Resume button visible on narrow screens.

4. `web/components/SubtitleDisplay.tsx`
   - Harden single and multi-line subtitle containers against overflow.
   - Apply max-width and wrapping guards (`overflow-wrap:anywhere`, `break-words`, `overflow-x-hidden`).

5. `web/app/history/HistoryListItem.tsx`
   - Mirror home-page title overflow protections for `/history`.

6. `web/app/globals.css`
   - Add reusable `.line-clamp-2-safe` utility for consistent two-line title clamping.

## Test Plan

1. Run:
   - `cd web && npm run lint`
   - `cd web && npm run build`

2. Validate on local dev server with these viewports:
   - `375x812`
   - `390x844`
   - `414x896`
   - `768x1024`

3. Verify at `/` and `/history`:
   - no horizontal scrollbar
   - long titles remain inside viewport
   - controls (player/subtitle controls, bottom tabs, resume button) remain usable

4. Script check:
   - `document.documentElement.scrollWidth <= document.documentElement.clientWidth`

## Acceptance Criteria

- Long titles and subtitles never cross viewport edge on tested viewports.
- Overflow behavior uses wrapping or two-line clamping (not unreadable tiny text).
- No unrelated Docker/security/deployment/audio-pipeline behavior changes.

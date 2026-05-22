# Country Explorer
A browser-based tool to search, filter, and compare countries using the free REST Countries API.

## How to run
No install required. Just open the file:

    open index.html        # macOS
    start index.html       # Windows
    xdg-open index.html    # Linux

Or serve it locally (optional, avoids any CORS edge cases):

    npx serve .
    # then open http://localhost:3000

No API key needed. The REST Countries API is free and public.




# ANSWERS

## 1. How to run

No installation required. Open `index.html` directly in any modern browser:

    open index.html         # macOS
    start index.html        # Windows
    xdg-open index.html     # Linux

Optional local server (avoids any browser CORS restrictions on file:// URLs):

    npx serve .
    # Visit http://localhost:3000

No API key needed.

## 2. Stack choice

Vanilla HTML/CSS/JS with no build step. Why:
- The task is a public API consumer no backend, no auth, no state management complexity.
- Zero dependencies means zero install friction: the grader opens one file.
- The REST Countries API returns everything in a single call, so there's no need for a framework's reactivity system.

A worse choice would be a Next.js or Create React App setup: you'd need Node, npm install, a build step, and the added complexity gives no benefit here. A plain Python/Flask server would also be worse — it adds a runtime dependency for something that doesn't need a backend.

## 3. One real edge case

**Fetch timeout** — `app.js`, lines 15–27 (`fetchWithTimeout` function).

The `AbortController` cancels the request after 8 seconds. The `catch` block distinguishes `AbortError` (timeout) from a genuine network or API error and gives a different message. Without this, if the REST Countries API is slow or down, the browser's default fetch would hang indefinitely with no feedback to the user. The AbortError check on line 23 is important: without it, a timeout would fall through as a generic "Failed to fetch" and the user wouldn't know to try again.

## 4. AI usage

- **Claude * — asked it to summarize the entire project. It produced basic HTML/CSS/JS structure.

  **What I changed:** The original AI output used `innerHTML` to insert country data without any escaping. I added the `escHtml()` function (bottom of app.js) and wrapped every user-visible string from API data through it. Country names can contain characters like `&` (e.g. "Turks & Caicos") and apostrophes — without escaping, inserting those raw into innerHTML is an XSS vector. I also changed the debounce delay from 300ms to 200ms after testing — 300ms felt sluggish on fast typing.

## 5. Honest gap

The card grid loads up to 120 countries at once and creates that many DOM nodes immediately. With a fast machine it's fine, but on slower hardware or mobile it can cause a noticeable paint delay. The fix would be virtual scrolling (only render cards in the visible viewport, e.g. with `IntersectionObserver` or a library like `@tanstack/virtual`) or pagination. With another day I'd implement a simple IntersectionObserver-based approach — render 30 cards, watch the last one, append the next 30 when it enters the viewport.

# Running App — Product Definition

## Vision

A personal running dashboard for a single authenticated user. Connects to both Strava and Garmin to pull in activity data, visualizes GPS routes and training trends, and helps track progress toward goals. Responsive web app that works on desktop and mobile.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Fullstack, responsive, great DX |
| Database | PostgreSQL + Prisma | Relational, typed ORM |
| Auth | NextAuth.js | Simple credential login, single user |
| Maps | Mapbox GL JS | Route maps + heatmap layer |
| Charts | Recharts | Lightweight, composable, React-native |
| Styling | Tailwind CSS | Fast, clean/minimal aesthetic |
| Deployment | Vercel | Native Next.js support |

---

## Core Features

- **Auth**: Single-user login to protect the app
- **GPX/FIT file upload**: Drag-and-drop activity import — works with any GPS watch
- **Intervals.icu sync**: Optional automatic sync via free intervals.icu API (Garmin/Strava feed through it)
- **Run list**: Paginated list of all runs with key stats (date, distance, pace, duration)
- **Run detail**: Individual run page with GPS route map
- **Heatmap**: All-runs overlay on a single map
- **Training trends**: Weekly mileage, zone distribution, consistency calendar
- **Goal tracking**: Set weekly/monthly distance goals, track progress

---

## Design Principles

- Clean and minimal — white space, data-first, no clutter
- Responsive — desktop and mobile layouts
- Fast — data loaded once, cached locally where possible

---

## Build Waves

### Wave 1 — Foundation
> Goal: Working app skeleton with auth and run data flowing in via file upload

- [ ] Next.js project setup with Tailwind, Prisma, NextAuth
- [ ] PostgreSQL schema: User, Activity
- [ ] Single-user credential login (email + password)
- [ ] GPX/FIT file upload — parse and store activity data (date, distance, pace, duration, GPS coordinates, heart rate)
- [ ] Basic run list page (no maps yet, just stats)
- [ ] **Test**: Login works, upload a GPX/FIT file, run appears in list with correct stats

### Wave 2 — Intervals.icu Sync + Run Detail
> Goal: Automatic sync connected, individual run pages live

- [ ] Intervals.icu API integration (API key auth)
- [ ] Sync endpoint that pulls activities from intervals.icu and stores them
- [ ] Deduplicate activities (uploaded vs. synced)
- [ ] Run detail page with stats breakdown
- [ ] **Test**: Intervals.icu syncs, no duplicates, detail page loads correctly

### Wave 3 — Maps
> Goal: GPS routes visible on individual run pages and heatmap view

- [ ] Mapbox GL JS setup
- [ ] Individual run route map (render GPS polyline on run detail page)
- [ ] All-runs heatmap page (render all GPS tracks as a heatmap overlay)
- [ ] **Test**: Routes display accurately, heatmap loads without crashing on large datasets

### Wave 4 — Dashboard & Goals
> Goal: A coaching-first dashboard that surfaces the signals that actually matter for marathon training

- [ ] Dashboard home page with summary stats (total runs, total distance, current week)
- [ ] Weekly mileage bar chart — rolling 8 weeks
- [ ] Training zone distribution chart — easy / moderate / hard % per week
- [ ] Consistency calendar — GitHub-style activity grid showing run/no-run per day
- [ ] Goal creation: set weekly or monthly distance target
- [ ] Goal progress indicator on dashboard
- [ ] Polish: loading states, empty states, mobile layout review
- [ ] **Test**: Charts render correctly, goals persist and update as runs sync

> See [FEATURES.md](./FEATURES.md) for the full coaching feature backlog and future wave ideas.

### Wave 5 — Analysis Tab: Aerobic Development
> Goal: A dedicated analysis space where you can interrogate any date window and understand how your aerobic engine is developing — the heart-rate-centric view a marathon coach checks every week.

The key insight from the research: the single most valuable signal for marathon development is whether your heart rate at a given effort is trending **down** over time. That means you're doing the same work with less cardiovascular strain — your aerobic engine is getting stronger. This wave builds the tooling to see that clearly.

**Infrastructure**
- [ ] New `/analysis` route with "Analysis" tab added to the nav
- [ ] Date range control at the top of the page: a dual-handle slider for quick scrubbing, plus manual date-entry inputs for precision — defaults to 2 weeks ago → today on every page load
- [ ] All charts on the page respond live to the date range control
- [ ] Unit preference (mi/km toggle, same as the runs list) applied to all distance/pace values

**Aerobic Development Scatter (Heart Rate)**
- [ ] Scatter plot: distance on x-axis, average HR on y-axis, one dot per run in the selected period
- [ ] Dots colored on a cool-to-warm gradient from oldest (blue) to most recent (orange/red), so the visual direction of the cloud immediately reveals whether HR at a given distance is falling — aerobic improvement — or rising — accumulated fatigue or overreach
- [ ] Tooltip on hover: run name, date, distance, avg HR, avg pace

**Aerobic Efficiency Trend**
- [ ] Line chart of aerobic efficiency (pace ÷ avg HR, in sec/km per bpm, or sec/mi per bpm) plotted per run over time
- [ ] A rising line means the same cardiovascular effort produces faster running — the single most distilled signal of aerobic fitness development
- [ ] Only include runs where HR data is present; show an empty state if fewer than 3 qualifying runs exist in the window

**HR Zone Distribution**
- [ ] Stacked bar chart: one bar per week in the selected period, broken into easy / moderate / hard % by time
- [ ] Targets zone: most marathon coaches prescribe 75–80 % easy. Highlight weeks that fall significantly below that threshold with a subtle visual marker
- [ ] Richer than the Wave 4 summary — this view makes polarized training patterns (or the lack of them) immediately visible

**Heatmap Polish**
- [ ] Heatmap page defaults to centered on Manhattan, NYC (zoom ~12) instead of fitting all tracks globally — makes the initial view immediately useful for a NYC-area runner

- [ ] **Test**: Date range slider updates all three charts simultaneously; aerobic efficiency correctly inverts pace/HR; zone bars add to 100 %; heatmap opens on Manhattan

---

### Wave 6 — Training Load & Race Readiness
> Goal: Coach-grade load management — the metrics that predict injury risk and race-day readiness before race day arrives.

The Wave 5 analytics answer "how is my aerobic base developing?" Wave 6 answers "am I building load safely, and am I ready to race?"

**Fitness-Fatigue Curve**
- [ ] Compute TRIMP (Training Impulse) per activity: duration × avg HR × a zone-weighted multiplier — a principled proxy for training stress that requires no power meter
- [ ] Three-line chart over a rolling ~6 months:
  - **CTL** (Chronic Training Load) — 42-day exponentially weighted average of TRIMP — represents fitness
  - **ATL** (Acute Training Load) — 7-day exponentially weighted average of TRIMP — represents fatigue
  - **TSB** (Training Stress Balance) — CTL minus ATL — represents race readiness (positive = fresh, negative = fatigued)
- [ ] Tooltip for each day showing the three values and most recent run

**Acute:Chronic Load Ratio (Injury Risk Indicator)**
- [ ] Single prominent number: ATL ÷ CTL for the current week
- [ ] Color-coded: green (0.8–1.3 = safe build), amber (1.3–1.5 = caution), red (> 1.5 = high injury risk)
- [ ] Short contextual label below it (e.g. "Sustainable build" / "Pushing the limit — consider an easy day" / "Overreach risk — rest recommended")
- [ ] Research basis: acute:chronic ratio > 1.5 is the most widely validated injury-risk threshold in sports science

**Long Run Progression**
- [ ] Bar chart: the longest run of each week over the last 16 weeks (a typical marathon block)
- [ ] Helps identify whether long run distance is progressing at the recommended ~10 % per week ceiling, plateauing, or spiking dangerously

**Pace at Aerobic Effort (Zone 2 Pace Trend)**
- [ ] Filter to runs where > 60 % of HR time was in Zone 2 (easy aerobic), plot their average pace per run over time
- [ ] This isolates aerobic base speed — the number that reliably predicts marathon potential — free of the noise introduced by tempo, intervals, and race days

- [ ] **Test**: TRIMP values match manual calculations on a sample activity; ATL/CTL curves move in the correct direction when a high-load week is added; injury ratio alert color changes at the correct thresholds; long run bars reflect actual data

---

### Wave 7 — Race Goals, PRs, Auto-Sync & Run Deep Dive
> Goal: Close the coaching loop — "am I on track for my goal race?" — and add a per-run microscope for aerobic-engine development.

**Auto-Sync on Login**
- [x] Every login fires a background Intervals.icu sync (last 30 days) via a NextAuth `signIn` event — fire-and-forget, never blocks login
- [x] Manual Sync button retained for full-history pulls

**Raw Stream Storage**
- [x] New `ActivityStream` table: per-second time / heart rate / velocity / altitude / cadence / distance arrays per run
- [x] Streams fetched from the Intervals.icu `streams.json` endpoint on sync (with backfill for already-synced runs)
- [x] GPX/FIT uploads now extract and store the same streams

**Run Deep Dive tab (`/deep-dive`)**
- [x] Defaults to the latest run; dropdown to inspect any run; linked from each run detail page
- [x] Summary header: distance, duration, pace, avg/max HR, TRIMP (relative effort)
- [x] HR chart with the Maffetone (180 − age) target band — age entered once and stored; headline % of run at/below MAF
- [x] Smoothed pace chart with Pace ↔ GAP toggle (Minetti grade-adjustment, Strava-style)
- [x] Elevation profile, per-mi/km splits table (pace, GAP, HR, elevation gain), time-in-zone bar

**Race Goals & Predictions (`/goals`)**
- [x] Race goal CRUD: name, date, distance, goal time
- [x] Riegel-formula predicted finish from your best recent effort (90-day window), color-coded vs goal

**Personal Records**
- [x] Best efforts auto-detected for 1K / 1 mile / 5K / 10K / HM / marathon as rolling sub-splits of the distance stream (whole-run fallback marked "est.")
- [x] PR board with progression chart per distance; PR badge on record-holding run pages

- [x] **Test**: Login returns in <100 ms while sync runs in background; new runs + streams appear without manual sync; MAF band renders at 180 − age; Riegel prediction verified by hand (4:00:03 from a 52:11 10K); goal CRUD and validation errors verified; unauthenticated requests rejected

---

### Wave 8 — Segments & Route Comparison
> Goal: Make it effortless to compare the same stretch of road across different dates, so aerobic improvement is visible as concrete numbers — not just abstract trends.

The deep insight: a scatter plot of HR over time is motivating, but nothing beats seeing your HR on the exact same 3-mile stretch drop from 158 bpm to 144 bpm over a training block. This wave builds that comparison surface on top of the per-second stream data already stored.

**Segment Library**
- [ ] New `/segments` tab in the nav
- [ ] A segment is a named start-to-finish stretch defined by drawing on a map (click start point, click end point — no complex UI)
- [ ] Segments are saved to the database with a name, start/end lat-lng, and a reference GPS polyline extracted from the defining run
- [ ] "Create segment from this run" shortcut button on the run detail page — pre-fills the route from that run's GPS track so the user can trim and name it in seconds

**Automatic Run Matching**
- [ ] On save, each segment is matched against all stored runs: a run qualifies if it passes within 50 m of both the start and end points in the correct order
- [ ] Matching runs are stored in a `SegmentEffort` join table: segment, activity, entry index, exit index, elapsed time, avg HR, avg pace, avg GAP, elevation gain
- [ ] New runs are matched on sync/upload — no manual action required

**Segment Comparison View**
- [ ] Selecting a segment shows a ranked effort table: one row per matched run, columns for date, elapsed time, avg pace, avg GAP, avg HR, and aerobic efficiency (pace ÷ HR) — sortable by any column, defaulting to date descending
- [ ] Best effort per column highlighted (fastest time, lowest HR, highest efficiency)
- [ ] Two overlaid charts time-aligned from segment entry:
  - HR trace per run, colored oldest-to-newest on the same blue→orange gradient used in the Wave 5 scatter — the visual direction of the bundle shows adaptation at a glance
  - Pace/GAP trace with the same color scheme and a toggle matching the deep dive
- [ ] Clicking any row in the table highlights that run's trace in both charts and opens its full run detail in a side panel

**Discoverability**
- [ ] Run detail page surfaces a "Segments on this run" card listing any saved segments the run matched, each linking to that segment's comparison view
- [ ] Analysis page links to `/segments` with a prompt to create a first segment if none exist

- [ ] **Test**: A segment created from run A auto-matches run B which shares the route; a run with the opposite direction does not match; effort table values match manual calculation from the stream data; adding a new run via sync automatically creates a `SegmentEffort` row if it matches; chart traces align correctly at time-zero (segment entry point, not run start)

---

### Wave 9 — Branding & Public Landing Page
> Goal: Give the app a public face and a proper identity before sharing it.

- [x] App renamed to **RUNNA**
- [x] Public landing page at `/` — full-screen Central Park hero image, "Track Every Mile. Own Every Run." headline, brief app description, Get Started CTA
- [x] Strava-style nav: RUNNA logo (favicon) top-left, Log In button top-right
- [x] Password updated to `Running-Ninja-Knicks23`
- [x] Page title and metadata updated to RUNNA throughout

---

### Wave 10 — Login Auditing, Settings Tab & Mobile Polish
> Goal: Harden the app's security posture with login audit logging, give the user a Settings home for account-level controls, and make the UI genuinely usable on a phone.

**Login Audit Logging**
- [ ] New `LoginEvent` table in Prisma schema: `id`, `userId`, `timestamp` (UTC), `ipAddress`, `userAgent`, `country` (geo-resolved from IP via a lightweight lookup, nullable), `city` (nullable)
- [ ] On every successful NextAuth `signIn` event, insert a `LoginEvent` row — fire-and-forget, never blocks login
- [ ] IP is read from the `x-forwarded-for` header (Vercel sets this); fall back to the direct socket address
- [ ] Geo-resolution uses a local MaxMind GeoLite2 City database (no external request per login — fast and offline-safe)

**Settings Tab**
- [ ] New `/settings` route with "Settings" added to the main nav
- [ ] Page sections: **Account** (display name, email — read-only for now), **Security** (login history panel)
- [ ] "Show Login History" toggle button expands an inline table: columns for Date & Time, Location (City, Country), IP Address, and Device (parsed from User-Agent — e.g. "Chrome on macOS")
- [ ] Table is paginated at 10 rows per page, newest-first; empty state if no events yet
- [ ] Login events older than 90 days are automatically pruned by a lightweight cleanup triggered on page load (async, non-blocking)

**Mobile-Friendly Polish**
The goal is a smooth one-thumb experience on a 390 px screen — not a stripped-down version, but a layout that reorganises for the smaller canvas.

- [ ] **Hamburger nav**: on `sm` breakpoint and below, collapse the top nav into a slide-in drawer triggered by a hamburger icon (☰); the drawer overlays the page with a semi-transparent backdrop, closes on outside tap or the ✕ button, and lists all nav links in a large, finger-friendly list (min 48 px tap target per link)
- [ ] **Touch targets**: audit all interactive elements (buttons, links, chart dots, table rows) and enforce a minimum 44 × 44 px tap area — add padding where needed without altering visual size
- [ ] **Responsive typography**: switch heading sizes from fixed `text-2xl/3xl` to fluid Tailwind clamp steps (`text-xl md:text-3xl`) so copy never overflows on narrow screens
- [ ] **Card stacking**: all two-column stat cards (dashboard, goals, PRs) collapse to a single-column stack below `md`; maintain the same visual hierarchy, just vertical
- [ ] **Chart interactions**: replace hover-only tooltips with tap-to-show tooltips on Recharts and Mapbox layers — mobile browsers do not reliably fire `mouseover` events
- [ ] **Sticky bottom bar (mobile only)**: on `sm` and below, render a fixed bottom bar with icon shortcuts to Dashboard, Runs, Analysis, and Settings — mirrors the pattern of every major fitness app and keeps key navigation reachable with one thumb; hides on `md+` where the top nav is visible
- [ ] **Table scroll**: run list and segment effort tables wrap in a horizontally scrollable container on mobile so columns are never truncated; add a subtle `overflow-x: auto` shadow cue to signal scrollability
- [ ] **Upload UX**: the drag-and-drop GPX/FIT upload zone falls back to a large "Tap to select file" button on touch devices (drag-and-drop is unusable on mobile)
- [ ] **Viewport & font-size**: confirm `<meta name="viewport" content="width=device-width, initial-scale=1">` is set and that no element forces a horizontal scrollbar on a 390 px canvas

- [ ] **Test**: Login events appear in the Settings table immediately after signing in; geo fields populate correctly for a known IP; pruning removes events > 90 days on Settings page load; hamburger drawer opens and closes correctly on a 390 px viewport; bottom bar is visible on mobile and hidden on desktop; all charts respond to tap tooltips; no horizontal overflow on iPhone SE (375 px) in Chrome DevTools

---

### Wave 11 — Location in Login History, Deep Dive Inline & Weekly Volume Chart
> Goal: Enrich the login audit trail with geographic detail, consolidate the run deep dive into the run detail page, and add a weekly volume chart to the analysis tab.

**Login History: City & State**

The Wave 10 `LoginEvent` schema already stores `country` and `city` via MaxMind GeoLite2 City. Adding **state / region** is fully feasible with the same local database — `record.subdivisions[0].names.en` returns the state or province for any IP that resolves to a sub-national region.

- [ ] Add a `region` column (nullable `String`) to the `LoginEvent` Prisma model alongside the existing `city` and `country` columns
- [ ] On every login event, populate `region` from the MaxMind lookup — same fire-and-forget write that already stores city and country; no additional latency
- [ ] Update the Settings login history table to show a combined "City, State" column (e.g. "New York, NY") using the stored `city` and `region` values; fall back to whatever fields are available (city only, region only, or "—") if the IP doesn't resolve to both

**Run Deep Dive — Inline on Run Detail Page**

The `/deep-dive` route (Wave 7) is removed. All deep dive content moves to the individual run detail page (`/runs/[id]`), appearing below the route map in a clearly labelled section.

- [ ] Remove the Deep Dive nav link and the `/deep-dive` route entirely
- [ ] On `/runs/[id]`, after the existing route map, render a **Deep Dive** section containing all the content that was on the deep dive page:
  - Summary header: distance, duration, pace, avg/max HR, TRIMP
  - HR chart with MAF band (180 − age) and headline % at/below MAF
  - Smoothed pace chart with Pace ↔ GAP toggle
  - Elevation profile
  - Per-mi/km splits table (pace, GAP, HR, elevation gain)
  - Time-in-zone bar
- [ ] The deep dive section only renders if stream data exists for the run; show a clean empty state ("No stream data available for this run") otherwise
- [ ] Remove the "Run Deep Dive" dropdown that previously let users switch between runs — the run detail page already scopes everything to a single run

**Analysis Tab — Weekly Volume Chart**

Below all existing analysis charts, add a stacked bar chart that shows how many miles and how many runs were completed in each calendar week within the currently selected date range.

- [ ] One bar per calendar week in the selected range; x-axis labels show the week-start date (e.g. "Jun 9")
- [ ] Each bar has two stacked segments: **Miles** (bottom, primary brand color) and **Runs** (top, secondary accent color)
- [ ] Both segments are scaled on the same y-axis as total bar height = miles + run count — the intent is a quick visual of volume, not precise run-count comparison; a legend clearly labels both segments
- [ ] Tooltip on hover/tap shows week range, total miles, and run count for that week
- [ ] Chart responds live to the date range slider like all other analysis charts
- [ ] Empty state if no runs exist in the selected window

- [ ] **Test**: `region` field populates in the Settings table for a known US IP (e.g. "New York, NY"); Settings table gracefully shows partial data for IPs that only resolve to country; deep dive section appears on `/runs/[id]` for a run with stream data and shows the correct empty state for a run without; `/deep-dive` route returns 404; weekly volume chart bars reflect the correct week buckets and update when the date range slider moves; stacked segments and tooltip values match the underlying run data

---

### Wave 12 — Weather Overlay, Demo Account, Landing Copy & Heatmap Range
> Goal: Bring an external data source (weather) into the training-load story, make the app shareable via a sandboxed demo login, refresh the landing page copy, and let the heatmap be scoped to a date range instead of always showing everything.

**Landing Page Copy**
- [ ] `app/page.tsx` hero headline changes from "Track Every Mile. Own Every Run." to **"Track every run. Log every step and beat."**
- [ ] Subhead changes to **"Your personal running trainer. Visualize each run, analyze your training load, and reach your goals"**
- [ ] No layout/structural changes — copy swap only

**Weather Overlay (Open-Meteo)**

Field selection is driven by what actually predicts performance degradation, not just what's easy to show. Plain relative humidity and a hand-rolled heat index are both weaker signals than what's available directly from the API for free:

- [ ] Three new nullable columns directly on `Activity` (no joined table — this is genuinely "bare minimum, alongside the run data"): `weatherTempC Float?`, `weatherDewPointC Float?`, `weatherApparentTempC Float?`
- [ ] A fourth column, `weatherFetchedAt DateTime?`, records when a fetch was *attempted* (success or definitive failure) — this is the field that makes the "only call the API for runs that don't have it yet" requirement work: any backfill/sync job filters on `WHERE weatherFetchedAt IS NULL` before calling out, so already-processed runs (and runs already known to be unfetchable, e.g. missing GPS) are never re-queried
- [ ] Source: [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api), hourly `temperature_2m`, `dew_point_2m`, `apparent_temperature` — no API key required
  - `dew_point_2m` is stored instead of relative humidity: dew point is an absolute moisture measure and a better predictor of how much sweat evaporation (the runner's actual cooling mechanism) is being blunted, whereas relative humidity is temperature-relative and reads misleadingly across different temps
  - `apparent_temperature` is stored instead of computing our own heat index: Open-Meteo's version already folds in wind and solar radiation on top of humidity, which is a more complete heat-stress read for someone generating heavy metabolic heat than the NWS heat-index formula (built for a resting person in shade) — and it means no server-side formula to write or maintain
- [ ] For each run needing weather, use its GPS start coordinate (or centroid if no GPS) plus its date/time window; average the hourly points spanning the run's start→end, or take the single point nearest the run's midpoint for runs under ~2 hours — pick one approach and document it in the sync code
- [ ] Fetched on sync (Intervals.icu) and on GPX/FIT upload, same fire-and-forget pattern used for geo-resolution in `lib/auth.ts`; a failed/unreachable call still stamps `weatherFetchedAt` so it isn't retried on every future sync, but leaves the three data columns null
- [ ] Run detail page (and Deep Dive section) shows a small weather badge: temp, dew point, "feels like" — with unit-aware formatting (°F/°C matching the existing mi/km unit preference)

**Demo Account**

The demo login sees real data but only a configurable date window set by the admin, and has no ability to change anything. Decided approach: a centralized data-access layer — see rationale below.

*Credentials & auth*
- [ ] New `hello@ronithranjan.com` / `ILoveRunning23` credential, distinct from the existing single-admin login in `lib/auth.ts` (`ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`) — `authorize()` gains a second branch checked against new `DEMO_EMAIL` / `DEMO_PASSWORD_HASH` env vars
- [ ] NextAuth `jwt`/`session` callbacks stamp `isDemo: boolean` onto the session (no callbacks exist today — this wave adds them), so every server component and route handler can check `session.isDemo` via `getServerSession(authOptions)`
- [ ] Demo session must not trigger real Intervals.icu/Strava/Garmin syncs
- [ ] Do not store credentials in the README or anywhere publicly visible — share only directly

*Admin-configurable date window (Settings page)*
- [ ] Add two new nullable columns to the existing single-row `UserSettings` model: `demoFromDate DateTime?` and `demoToDate DateTime?` — these live in the same table as `age`, no new model needed; default (null) falls back to January 1 – March 31, 2026 hardcoded in `lib/activities.ts`
- [ ] `app/api/settings/route.ts` `GET` and `PUT` handlers extended to read/write `demoFromDate` and `demoToDate` alongside the existing `age` field; the `PUT` validates that both are valid dates and that `from` is before `to`
- [ ] Settings page (`app/(protected)/settings/page.tsx`) gains a new **Demo Access** section, visible **only when the admin is logged in** (`session.isDemo` is false and the user email matches `ADMIN_EMAIL`) — the section shows the currently configured date range and two date-picker inputs (start / end) with a Save button; saving calls `PUT /api/settings`; the section is not rendered for the demo session at all (blocked as a write path anyway)

*Data access layer*
- [ ] New `lib/activities.ts` — the one place that knows about the date restriction. On every call it reads `demoFromDate`/`demoToDate` from `UserSettings` (falling back to Jan 1 – Mar 31, 2026 if null) and merges `{ date: { gte: fromDate, lte: toDate } }` into the Prisma `where` clause whenever `session.isDemo` is true; passes through unfiltered for the admin
- [ ] Refactor the existing **read** call sites to go through `lib/activities.ts` instead of calling `prisma.activity` directly: `app/(protected)/analysis/page.tsx`, `app/(protected)/goals/page.tsx`, `app/(protected)/runs/page.tsx`, `app/(protected)/runs/[id]/page.tsx`, `app/api/activities/route.ts`, `app/api/activities/geo/route.ts`
- [ ] `getActivityById` must include the date bound in its `WHERE`, not check it after the fact — so a demo user cannot see an out-of-range run by typing its ID into `/runs/[id]` directly; it returns the same "not found" as a nonexistent ID
- [ ] All **write** paths (`app/api/activities/upload/route.ts`, sync, goal CRUD, settings mutations) return 403 for `session.isDemo` — read-only is a separate axis from the date restriction

*Why this method, not the alternatives considered:* filtering ad hoc at each of the 6+ read call sites was ruled out because nothing stops a future route from forgetting the check. An ORM-level filter (Prisma Client Extension + `AsyncLocalStorage`) was ruled out as disproportionate for a personal app — nothing in the codebase uses that pattern today, it doesn't cover raw SQL escapes, and it makes the restriction invisible in the code that uses it. The centralized-helper approach gets the same practical guarantee with no extra machinery.
`
**Heatmap Date Range**
- [ ] `/runs/heatmap` defaults to showing all runs (current behavior), but adds the same dual-handle `DateRangeSlider` component used on `/analysis`
- [ ] Selecting a range filters which GPS tracks render on the heatmap layer; clearing/resetting returns to all-time
- [ ] Slider domain bounds are the user's earliest → latest run, same pattern as `AnalysisView`

**"How to Use" Page**

A single explanatory page that gives any user — including the demo account — enough context to understand what they're looking at and what to do with it. Sits between Goals and Settings in the nav.

- [ ] New `/how-to-use` route (`app/(protected)/how-to-use/page.tsx`) added to the main nav between Goals and Settings
- [ ] Page is purely static/server-rendered — no data fetching, no interactivity, no charts
- [ ] Content is structured in three parts:
  1. **Overview** — what RUNNA is and the philosophy behind it: train by feel + data, build aerobic base first, protect yourself from injury through load awareness
  2. **Page-by-page guide** — one section per nav item (Dashboard, Runs, Heatmap, Analysis, Goals, Deep Dive within Runs) explaining what each page shows and what action it implies
  3. **Analysis deep dive** — a longer section covering every chart on the Analysis page in plain language: what it measures, how it's calculated, what a good vs. concerning trend looks like, and what to do about it — specifically covering Weekly Volume, Aerobic Development scatter, Aerobic Efficiency, Aerobic Pace (Zone 2), Effort Distribution, Fitness & Fatigue (CTL/ATL/TSB with the TRIMP formula explained), Acute:Chronic Load Ratio, and Long Run Progression
- [ ] Writing tone: plain English, no assumed running-science knowledge — explain what "Zone 2", "TRIMP", "CTL", "dew point" etc. mean inline rather than treating them as known terms
- [ ] No external links, no dynamic content — the page must render instantly and work for both the admin and demo sessions

- [ ] **Test**: page loads without auth errors for both admin and demo sessions; all nav links on the page are correct; content renders cleanly on mobile (390 px) with no horizontal overflow

**Analysis: Performance vs. Weather**
- [ ] New chart on `/analysis`: run performance (aerobic efficiency factor or Zone-2 pace, consistent with existing Wave 5 metrics) plotted against `weatherApparentTempC`, to surface how heat stress degrades pace-per-effort — apparent temperature is used as the x-axis (not raw temp) since it's the single field that already accounts for humidity, wind, and solar load
- [ ] Scatter plot, one dot per run with weather data: x-axis = apparent temperature, y-axis = efficiency factor (or pace), dot color encoding dew point as a secondary moisture signal
- [ ] Respects the page's existing date range control and mi/km ↔ °F/°C unit preference
- [ ] Only includes runs where `weatherFetchedAt` succeeded (data columns non-null); empty state if fewer than a handful of qualifying runs exist yet (expected immediately after this wave ships, before the backfill job has caught up on older runs)

- [ ] **Test**: landing page renders the new headline/subhead with no layout breakage; a newly synced/uploaded run gets `weatherTempC`/`weatherDewPointC`/`weatherApparentTempC` populated and `weatherFetchedAt` stamped; re-running sync does not re-call Open-Meteo for runs that already have `weatherFetchedAt` set; a run with unreachable Open-Meteo still gets `weatherFetchedAt` stamped (with null data columns) so it isn't retried; demo login succeeds and sees only runs within the admin-configured date window on the runs list, analysis charts, and heatmap; directly visiting `/runs/[id]` for an out-of-window run returns not-found for the demo session but loads correctly for the admin; demo session gets 403 on upload/sync/goal-CRUD/settings-mutation endpoints; admin Settings page shows the Demo Access section with the current from/to dates, saving a new range updates `UserSettings`, and the demo session immediately sees only that new window; admin session is completely unaffected by the date restriction; Settings Demo Access section is invisible when the demo account is logged in; heatmap slider narrows rendered tracks within the demo window; weather-vs-performance chart plots correctly against apparent temperature and updates with the date range slider

**Post-wave fixes (2026-07-04)**
- Timezone bug: sync stored `start_date_local` parsed in the server's TZ — on Vercel (UTC) every run timestamp landed 4 h early, making the weather fetch read the wrong hours. Sync now stores `start_date` (true UTC); weather queries use `timeformat=unixtime` so hour-matching is TZ-independent. All 104 existing activity dates repaired from the Intervals.icu API and weather re-backfilled.
- Weather sampling now averages the hourly samples bracketing the run (top of start hour → top of hour after end) instead of a ±30 min pad with knife-edge cutoffs.
- Age moved to Settings → Training (drives the MAF band on run HR charts); inline MAF editor removed from the run deep dive, replaced with a link to Settings when age is unset.
- Removed the orphaned `/deep-dive` route and `DeepDiveView` left over from Wave 11.

---

## Wave 13 — Time in Zone, Segments, Form Trends

> Goal: Move effort tracking from per-run averages to real time-in-zone, automatically discover the most-run segments and track performance on them over time, chart running form over time, and make the Sync button reliably show new runs without a page reload.

**Sync shows the latest run immediately (bug fix)**

Root cause: every login fires a background `runSync()` (`lib/auth.ts` `signIn` event) that isn't awaited. The runs page renders before it finishes, so the new run isn't in the list. When Sync is then clicked, the background sync has already stored it, `/api/sync` returns `synced: 0`, and `SyncButton` only calls `router.refresh()` when `synced > 0` — so the list never re-renders.
- [ ] `SyncButton` calls `router.refresh()` after **every** successful sync, not only when `synced > 0`
- [ ] Change the `synced === 0` message from "Already up to date" to "Up to date". The login sync may have just pulled in a new run, so "already" is misleading
- [ ] Guard against the login sync and a manual sync racing: concurrent `prisma.activity.create` on the same `externalId` hits the unique constraint and currently surfaces as a 502. Treat a P2002 unique violation in `runSync` as "skipped", not a failure
- [ ] Verify against Next 16 `router.refresh()` semantics (read `node_modules/next/dist/docs/` first) — the runs page must re-run its server query, not serve a cached RSC payload

**Weekly time spent easy / moderate / hard**

The existing Effort Distribution chart classifies a *whole run* by its average HR and shows only percentages. Now that `ActivityStream.heartrate` is stored, use true per-sample time-in-zone.
- [ ] New `weeklyTimeInZones()` in `lib/analysis.ts`, reusing `timeInZones()` from `lib/runAnalysis.ts` (same `EASY_CEILING` / `MODERATE_CEILING` bands) per run, summed per Monday-start week
- [ ] Runs without an HR stream fall back to the current avg-HR whole-run classification so no week silently loses time; tooltip notes how many runs used the fallback
- [ ] Chart shows **absolute time** (hours/minutes stacked: easy / moderate / hard) with a toggle to the existing **% view**; the 75 % easy target line only appears in % view
- [ ] Replaces the current `ZoneDistribution` chart (no duplicate cards); respects the Analysis date-range slider and the demo date window (streams loaded via `findActivities` include, never `prisma.activity` directly)
- [ ] Payload: compute zone totals server-side in `analysis/page.tsx` — don't ship raw HR streams to the client
- [ ] Update the Effort Distribution section of `/how-to-use`

**Auto-discovered segments: top 5 most-run stretches**

Routes are rarely repeated whole (runs get spliced together from familiar pieces), so the unit of comparison is the **segment**, a stretch run many times across different routes. Segments are discovered automatically by overlaying every GPS run and measuring where they overlap.

*Prerequisite: time-aligned GPS*
- [ ] Verify whether Intervals.icu `/map` coordinates are index-aligned with `ActivityStream.time`. If not, fetch the `latlng` stream (`data` = lats, `data2` = lngs) instead, store it time-aligned, and re-fetch once for existing runs. Discovery doesn't need timestamps, but timing efforts does. GPX/FIT uploads are already aligned

*Discovery (`lib/segments/discover.ts`, pure functions, unit-tested)*
1. [ ] **Resample** every GPS run to one point per 10 m along its path (local metric projection), so recording rate doesn't bias anything
2. [ ] **Overlay on a grid** of ~20 m cells. Each run marks the cells it passes through **plus their immediate neighbours**, which absorbs GPS noise so the same path on different days lands in the same cells. Counts are *distinct runs* per cell, so laps don't inflate a cell
3. [ ] **Hot cells** = cells touched by ≥ `MIN_RUNS` runs (start at 5)
4. [ ] **Candidate stretches**: walk each run's resampled path and cut out the maximal stretches that stay in hot cells (bridging gaps < 50 m), keeping those ≥ `MIN_LENGTH` (start at 800 m)
5. [ ] **Split at junctions**: along each candidate, cut where the set of runs passing changes (Jaccard similarity of run sets drops below ~0.7; a branch joins or peels off). Each piece then has roughly uniform traffic and ends at a natural decision point
6. [ ] **Merge duplicates**: candidates from different runs describing the same stretch (ends within 50 m, ≥ 90 % shape overlap) collapse into one. The representative geometry is the medoid, the candidate closest to all the others, so one noisy GPS trace doesn't define the segment
7. [ ] **Direction**: count efforts per direction. A segment takes its dominant direction; the reverse becomes its own candidate if it independently qualifies
8. [ ] **Strength** = number of distinct runs with a full effort on it (via the matcher below), tie-broken by length. Exclude stretches whose start is within ~300 m of the most common run start, so "the first block outside the front door" doesn't win every time
9. [ ] **Top 5**, chosen greedily by strength, skipping any candidate that overlaps an already-picked segment by > 30 %

*Effort matching (`lib/segments/match.ts`)*
- [ ] Bounding-box prefilter (segment bbox + 50 m) → every pass within 30 m of the segment start → first point after it within 30 m of the end, with path length within ±15 % of the segment → both-way shape check: ≥ 90 % of points within 40 m. One run can yield multiple efforts
- [ ] Start/end crossing times interpolated between GPS samples, not snapped to the nearest sample
- [ ] Per effort: elapsed time, avg pace, avg HR, EF, grade-adjusted pace, plus that run's weather

*Storage & refresh*
- [ ] New `Segment` (geometry resampled at 10 m, length, elevation profile, direction, strength, `name`, `pinned`) and `SegmentEffort` (segment, activity, start/end sample index, interpolated start/end time, metrics) tables
- [ ] Discovery runs from an admin action ("Rediscover segments" in Settings) and after a sync adds runs, never on page load. New runs get efforts matched against existing segments on sync
- [ ] Re-discovery is stable: a new top-5 candidate overlapping an existing segment by ≥ 70 % updates it in place, keeping your rename. Pinned segments are never dropped
- [ ] Segments get auto-names from position ("Segment 1 · 1.4 km"), renameable

*Views*
- [ ] **`/segments`** page (in nav near Heatmap): map with the 5 segments highlighted, each card showing length, elevation gain, effort count, best/latest time
- [ ] **Segment detail** (`/segments/[id]`):
  - efforts table and trend chart (pace, avg HR, EF over date), so faster-at-the-same-effort is visible
  - **speed vs. elevation overlay**: pick up to 5 efforts; x = distance along the segment (each effort projected onto the segment geometry so hills line up), y = speed (unit-aware), elevation profile shaded behind
- [ ] Heatmap: segments drawn as a highlighted layer; clicking one opens a popup linking to its detail page
- [ ] Run detail page lists the segment efforts in that run, with rank among all efforts
- [ ] All queries respect the demo date window

*Validation before UI*
- [ ] Run discovery on real data and render the top ~10 candidates on a static map for review; tune `MIN_RUNS`, `MIN_LENGTH`, cell size and split threshold before building the pages

*Implementation notes (as built, 2026-10-09). These differ from the plan above:*
- Effort endpoint radius is 50 m, not 30 m. On real data a run cutting a corner passed the start at 41 m
- Discovery over-counts: a run that turns off just before the end still "supports" the stretch. So a pool of 15 discovered candidates is re-ranked by matched efforts and the top 5 kept. Stored strength = distinct runs with a full matched effort
- Speed along the segment uses a monotone dynamic-programming alignment of GPS samples to the segment (not greedy nearest-point projection, which broke on GPS wobble at stops and corners). Binned every 20 m and smoothed over 100 m as distance ÷ time
- Segments whose runs have no altitude stream get their elevation profile from Open-Meteo's elevation API (Copernicus 90 m DEM)
- "Rediscover" lives on the /segments page (admin only) rather than in Settings
- Grade-adjusted pace and EF per effort are not shown yet. Effort table has time, pace, avg HR, feels-like temp, rank
- First run on real data: Hudson River Greenway 1.3 km (18 runs), Ashburn 1.4 km (10), Belmont Ridge 1.7 km (9), Central Park east 1.4 km (9), Ashburn 0.9 km (9)

*Prior art: how this approach compares (researched 2026-10-09)*
- **`tracematch` / Veloq** (open source, built for Intervals.icu users: github.com/evanjt/tracematch): nearly the same pipeline. It rasterises tracks into a grid, keeps "hot" cells above a support floor, splits corridors where the *set of activities* passing changes, uses the medoid trace as geometry, and emits sections best-first with already-covered ground excluded. Route matching uses Average Minimum Distance, run both ways to catch subsets. Reported ~3 s for 426 tracks
- **Refinements adopted from it:**
  - split on a change in *which* runs pass (Jaccard overlap of run sets), not just how many. Two different groups of 15 runs on either side of a junction are different traffic even though the count is equal
  - scale the support floor with dataset size and segment length instead of a fixed 5
  - collapse each run to a single pass per cell before counting
- **Not adopted:** its ~100 m cells (sized for cycling/hiking over large areas; we stay at ~20 m for city-block-scale running). We'll compare both during tuning
- **TRACLUS** (Lee, Han, Whang, SIGMOD 2007): the classic partition-and-group sub-trajectory clustering. It confirms the core idea that clustering whole trajectories misses shared sub-paths. Its MDL partitioning + density line-segment clustering is more general but heavier than we need
- **KDE / grid map inference** (Biagioni & Eriksson; Davies et al.): the same density → threshold → centerline idea used to infer road maps from GPS. Known weakness: heavily used paths over-aggregate, lightly used ones fragment, which is what the adaptive support floor addresses
- **Strava**: segments are matched against stored geometry with a two-tier similarity threshold (patents US9116922 / US9208175). Effort start/end reportedly snap to the closest recorded point, causing tens-of-metres discrepancies with sparse recording; our start/end interpolation avoids this. Strava Metro snaps activities to OpenStreetMap edges and counts per edge, which is the map-matching alternative below
- **Map matching (HMM, Newson & Krumm 2009; OSRM/Valhalla/Mapbox Map Matching)**: snap each run to the OSM path network, then count runs per edge. It gives clean junctions and geometry for free, but adds an external dependency and fails off-network (trails, tracks, parks missing from OSM)
- **Discrete Fréchet distance**: order-aware similarity, sensitive to single GPS spikes and sampling rate. A candidate for the effort shape check if the percentage-within-corridor check proves too loose
- Intervals.icu `latlng` stream: latitude in `data`, longitude in `data2` (forum-confirmed, verify against a live response). This is the time-aligned GPS source for the prerequisite above

- [ ] **TODO: dedicated design session on segment algorithms** (before Phase 2 work, after the Phase 1 validation map exists). Walk through the approaches above with real candidate output side by side:
  - grid density vs. OSM map-matching vs. TRACLUS-style clustering
  - cell size (20 m vs 100 m)
  - count-change vs. run-set-change junction splitting
  - fixed vs. adaptive support floor
  - percentage-in-corridor vs. Average Minimum Distance vs. Fréchet for effort matching
  - ranking: run count vs. metres represented vs. a multi-feature score like tracematch's
  - whether to adopt `tracematch` directly (Rust; would need WASM or a port) instead of writing our own

  Outcome: settle the algorithm and thresholds and update this section

*Later: not this wave*
- *Manual segments*: draw your own by clicking two points on a heatmap track; same matcher
- *Effort-normalized comparison*: grade-adjusted pace + HR + weather overlay so a hot-day slowdown isn't read as lost fitness

**Cadence & stride length over time**
- [ ] Verify cadence units first: Intervals.icu / FIT cadence for running can arrive as **one-foot rpm** (~85) rather than steps per minute (~170). Check against a known run and normalize to steps/min in one helper (`normalizeCadence()`), applied at read time so stored data isn't rewritten
- [ ] Stride length derived per run as `speed ÷ (cadence / 60)` over samples where the runner is moving (velocity above a walking threshold), reported as average step length in m (ft-in when unit is mi — same convention Garmin uses for "stride length")
- [ ] Per-run averages computed server-side; new **Running Form** chart on `/analysis`: cadence (spm) and stride length on dual axes, one dot per run with a rolling 4-week average line
- [ ] Option to filter to easy runs only (via effort classification), since cadence and stride naturally rise with pace and mixing them hides the trend
- [ ] Runs without a cadence stream are skipped; empty state if fewer than a handful qualify
- [ ] Run detail deep dive gains a cadence line on the existing charts if the stream exists
- [ ] Add a Running Form section to `/how-to-use` (what cadence and stride length are, what a healthy trend looks like)

- [ ] **Test**: log in, record/upload a new run in Intervals.icu, click Sync on `/runs` without reloading → new run appears in the list; login sync + immediate manual sync no longer returns a 502; Effort chart shows hours per week in absolute mode and percentages summing to 100 % in % view, and a run with an HR stream that's half easy / half hard splits accordingly instead of counting as one zone; discovery returns 5 non-overlapping segments that each show ≥ 5 distinct runs and look right on the map; the front-door stretch is not among them; a run passing through a segment twice yields two efforts; a run that hits the start and end but takes a different street between does not match; renaming a segment survives re-discovery; the speed-vs-elevation overlay lines hills up across efforts; clicking a segment on the heatmap links to its page; cadence values land in the ~150–190 spm range after normalization; stride length is plausible (~0.8–1.4 m); demo session sees only in-window runs in segment efforts and form charts; all new views render at 390 px with no horizontal overflow

---

## Rules for Building

1. Complete one wave fully before starting the next.
2. After each wave, run the app and verify the test criteria listed above.
3. User reviews and approves before wave is marked done.
4. No feature creep — only build what's in the wave.

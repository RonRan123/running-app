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

## Rules for Building

1. Complete one wave fully before starting the next.
2. After each wave, run the app and verify the test criteria listed above.
3. User reviews and approves before wave is marked done.
4. No feature creep — only build what's in the wave.

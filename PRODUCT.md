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

## Rules for Building

1. Complete one wave fully before starting the next.
2. After each wave, run the app and verify the test criteria listed above.
3. User reviews and approves before wave is marked done.
4. No feature creep — only build what's in the wave.

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
- **Strava integration**: OAuth connection to pull runs
- **Garmin integration**: OAuth/API connection to pull runs
- **Run list**: Paginated list of all runs with key stats (date, distance, pace, duration)
- **Run detail**: Individual run page with GPS route map
- **Heatmap**: All-runs overlay on a single map
- **Training trends**: Weekly mileage, pace over time — charts
- **Goal tracking**: Set weekly/monthly distance goals, track progress

---

## Design Principles

- Clean and minimal — white space, data-first, no clutter
- Responsive — desktop and mobile layouts
- Fast — data loaded once, cached locally where possible

---

## Build Waves

### Wave 1 — Foundation
> Goal: Working app skeleton with auth and run data flowing in from Strava

- [ ] Next.js project setup with Tailwind, Prisma, NextAuth
- [ ] PostgreSQL schema: User, Activity, SyncLog
- [ ] Single-user credential login (email + password)
- [ ] Strava OAuth connection flow (connect/disconnect)
- [ ] Sync endpoint that pulls runs from Strava and stores them
- [ ] Basic run list page (no maps yet, just stats)
- [ ] **Test**: Login works, Strava connects, runs appear in list

### Wave 2 — Garmin + Run Detail
> Goal: Both data sources working, individual run pages live

- [ ] Garmin Connect API integration (OAuth or token-based)
- [ ] Sync endpoint for Garmin activities
- [ ] Deduplicate activities from both sources
- [ ] Run detail page with stats breakdown
- [ ] Store GPS coordinates (polyline/coordinates) per activity
- [ ] **Test**: Garmin syncs, no duplicates, detail page loads correctly

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

---

## Rules for Building

1. Complete one wave fully before starting the next.
2. After each wave, run the app and verify the test criteria listed above.
3. User reviews and approves before wave is marked done.
4. No feature creep — only build what's in the wave.

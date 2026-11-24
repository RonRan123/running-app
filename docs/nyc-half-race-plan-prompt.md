# Build prompt: Race plan & race-time projection for the NYC Half (Mar 21, 2027)

> Status: **draft for review — nothing built yet.** Edit anything below, answer the
> open questions at the end, and this becomes the brief I build from.

## 1. Goal

Add a **race-prep feature** to RONR that answers two questions for a race goal
(first user: United Airlines NYC Half, Sun **Mar 21, 2027**, 21.1 km — 17 weeks
from Mon Nov 23, 2026):

1. **How should my weekly mileage climb from now to race day?** A week-by-week
   plan (target miles, long run, phase) that starts from my *actual* recent
   training, adapts every week to what I really ran, and tapers into the race.
2. **What time can I run if I raced today, and where is it heading?** A
   projected finish *range* from my recent runs, how the projection was made,
   how confident it is, and how it has changed week to week.

## 2. What already exists (build on it, don't duplicate it)

| Existing piece | Where | What it does | Gap for this feature |
|---|---|---|---|
| Race goals | `app/(protected)/goals`, `RaceGoalCard`, `RaceGoal` model | Name, date, distance, goal time | No plan attached to the race |
| Race prediction | `lib/records.ts` → `predictRaceTime()` | Riegel (exp 1.06) from the fastest stretch of the *longest* PR distance in the last 90 days | Uses training-run splits as if they were races (an easy long run becomes the basis → pessimistic; a fast 1K extrapolated → optimistic). One number, no range, no confidence, no trend |
| 7-day plan | `lib/trainingPlan.ts`, `TrainingPlanCard` | Minutes-based, +10%/wk, cutback after 3 build weeks, ACWR ≤ 1.3, HR cap 156, long run ≤ 30% | No race date → never peaks or tapers; no workouts above easy; only 7 days ahead |
| Load & volume charts | `lib/analysis.ts` (CTL/ATL, ACWR, weekly volume, long run by week) | Shows past training | No planned-vs-actual view |

## 3. Approach

### 3a. Season plan (mileage progression) — new `lib/racePlan.ts`

Pure, deterministic function like `planNextWeek` (no clock, no network; takes
`today`, `timeZone`, activities, race goal, settings) so it's fully unit-testable.

**Inputs derived from history**
- Baseline = median weekly miles of the last 4 complete weeks (ignore a one-off
  outlier week); recent long run; historical peak week in the last 12 months
  (prior fitness comes back faster than new volume is built).

**Phases** (counted back from race day; 17 weeks for this race)

| Phase | Weeks | Dates (this race) | Focus |
|---|---|---|---|
| Base | 1–6 | Nov 23 – Jan 3 | Easy volume, strides; holiday week planned as cutback |
| Build | 7–12 | Jan 4 – Feb 14 | Volume keeps rising; one threshold/tempo session per week |
| Peak / race-specific | 13–15 | Feb 15 – Mar 7 | Highest volume, longest long runs, half-marathon-pace work, tune-up race/time trial |
| Taper | 16–17 | Mar 8 – Mar 21 | Cut volume, keep some intensity, race |

**Progression rules (best practice, cited in code comments)**
- Build in steps: ~**+5–10%/week** (smaller % at higher mileage), **cutback
  every 4th week to ~75–80%** — matches the existing planner's constants, so the
  two agree.
- Keep the existing safety rail: **ACWR ≤ 1.3** (Gabbett 2016) via the app's own
  `fitnessFatigue()`; the race plan never asks for more than the 7-day planner
  would allow.
- **Peak** = min(baseline × ~1.5–1.6, last-12-month peak × 1.1, user cap). For a
  recreational half, ~25–40 mi/wk is the usual peak range (Pfitzinger, Hansons,
  Higdon novice→intermediate plans).
- **Long run** ≤ ~30% of the week (existing rule), grows ≤ 1 mi (or 10 min) per
  build week, **peaks at 11–13 mi ~3 weeks out** (Mar 1); one optional 13–14 mi
  only if the base supports it.
- **Taper**: volume −40–60% over the final ~10–14 days, intensity kept, frequency
  roughly kept (Bosquet et al. 2007 meta-analysis; Mujika & Padilla 2003).
- **Intensity mix**: ~80% easy / ~20% moderate-hard (Seiler). From Build onward
  one quality day per week (tempo/threshold, later HM-pace), paces derived from
  the current race projection. *See open question 3 — today the app keeps every
  run under the 156 HR cap.*
- **Adaptive, not a fixed calendar**: each week is re-planned from what actually
  happened. Missed miles are *not* made up; if a week falls short, the next
  targets slide down and the peak is re-derived so it's still reachable safely.
  After a layoff, reuse the planner's existing return-to-run ramp.

**Integration with the 7-day plan**: the season plan supplies the week's target
and phase; `planNextWeek` keeps doing the day-by-day layout and safety checks
and takes `min(season target, its own ceiling)`. Taper weeks override downward.
Internally stay in minutes where the planner already does; show miles (via
recent easy pace, as the tile does today).

### 3b. Race-time projection — new `lib/racePrediction.ts`

Replace "one Riegel number" with a **blend of methods → a range + confidence**:

1. **Qualifying efforts only.** Use best efforts (5K–half, from streams) only
   when the effort was actually hard: average HR in the moderate/hard zones from
   `classifyEffort`, or the run is tagged a race/time trial. Easy runs never
   become a "best effort" basis.
2. **Riegel, mileage-adjusted.** `T2 = T1 × (D2/D1)^k`, `k ≈ 1.06` for
   well-trained runners; recreational / lower-mileage runners fade more
   (Vickers & Vertosick 2016), so use a slightly higher `k` (≈ 1.07–1.08) at low
   weekly mileage. Prefer the basis closest to 21.1 km (10K–15K > 5K > 1 mi).
3. **HR–pace model from everyday runs** (works with no hard efforts): fit pace
   vs. HR on steady runs from the last 6–8 weeks (exclude walks/intervals,
   correct for heat with the stored dew point), then read off pace at a typical
   half-marathon effort (~85–90% of max HR). Cross-checks method 2.
4. **Blend & range.** Weighted by recency and basis quality; show a range (e.g.
   "1:52–1:58, most likely 1:55"), not false precision. Confidence = High /
   Medium / Low from how many qualifying efforts exist and how much the methods
   agree.
5. **Race-day view.** Show (a) *if you raced today* — the honest number — and
   (b) a clearly-labelled, modest *if training goes to plan* estimate. Keep (b)
   conservative; don't promise big gains.
6. **Course note.** NYC Half: Prospect Park + Manhattan Bridge climbs, rolling
   Central Park finish, usually cool weather — small course adjustment only, shown
   as its own line so it can be turned off.
7. **What would sharpen it.** If confidence is Low, recommend a 5K time trial
   (~week 8) and a 10K/15K tune-up race (~week 13–14, e.g. an NYRR race), and
   build those into the plan.

### 3c. UI

- **Race page** `/goals/[id]` (linked from the race goal card):
  - Header: countdown, phase, "Week 3 of 17".
  - **Mileage chart**: planned vs. actual weekly miles (bars), long run (line),
    phase bands, cutback weeks marked, race-day marker.
  - **This week**: target miles, long run, quality session, progress so far —
    links to the existing 7-day tile.
  - **Projection card**: range, confidence, method breakdown, goal comparison,
    trend line of the projection over past weeks.
  - **"How this was set"** working, same style as `TrainingPlanCard`, plus a
    Guide entry with the sources.
- **Race goal card** gets a compact strip: phase · week x/17 · weekly target vs
  done · projected range (replaces today's single Riegel number).
- Analysis page's 7-day tile shows the phase when a race is ≤ 20 weeks out.

## 4. Constraints (from AGENTS.md)

- Read `node_modules/next/dist/docs/` for this Next.js version before routing work.
- Anything race-derived is personal → **never sent to the demo** (hide the race
  page and strip in demo, as race goals are today). Any new API route starts with
  `requireAdmin()`; activities are read only through `lib/activities.ts`.
- Pure logic in `lib/`, with Vitest tests: phase boundaries, cutbacks, peak cap,
  taper %, missed-week adaptation, layoff, Riegel exponent choice, effort
  qualification, HR-model fallback, range/confidence, demo exclusion.
- No new dependencies unless needed; reuse Recharts and the existing card styles.

## 5. Delivery order

1. `racePrediction.ts` + tests → upgrade the race goal card (quick win; fixes
   today's prediction weaknesses).
2. `racePlan.ts` + tests → race page with the mileage chart and the "this week"
   card.
3. Wire the season target into `planNextWeek`; add the phase to the 7-day tile.
4. Guide docs, then screenshots on a branch for you to review before merging.

## 6. Open questions for you

1. **Goal time** for the NYC Half? (Or should the app suggest one from the projection?)
2. **Limits**: max days/week you can run, a mileage ceiling, injury history the
   plan should respect? Long run day still Saturday?
3. **Intensity**: OK to add one tempo/HM-pace session per week from January, or
   keep everything under the 156 HR cap as the current plan does?
4. **Data**: any recent races or hard efforts (5K/10K) in your Strava history?
   Willing to do a time trial in ~January to sharpen the projection?
5. **Placement**: dedicated race page + compact card strip (proposed), or keep
   everything on the Goals page?
6. **Units**: plan shown in miles by default (follows the unit toggle) — OK?

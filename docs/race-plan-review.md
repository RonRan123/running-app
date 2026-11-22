# Race plan review: an LLM-as-judge method and what it found

Reviewed: `lib/racePlan.ts`, `lib/racePrediction.ts`, `lib/racePrinciples.ts`, `lib/raceServer.ts`, the race hint in `lib/trainingPlan.ts`, and how they fit the way the app will actually be used. Commit reviewed: `67d2081`.

**Bottom line.** For a runner who follows the plan, it is safe, explainable and close to what a coach would write. It falls down when life happens, which is exactly what you said you care about. A partial week, a holiday, the flu or a niggle each expose a flaw that either makes the plan collapse or makes it jump. Four problems are serious enough to fix before you rely on it:

1. the plan is all zeros after a break,
2. it spirals down if you run about 80% of every week,
3. the taper can jump far above recent training,
4. other race distances get half-marathon training.

---

## 1. The judge: how "good vs bad plan" is decided

The judge lives in `evals/plan-judge/`. It has three layers, cheapest and most trustworthy first.

### Layer 1: closed-loop personas (`personas.ts`)
A plan can't be judged from its opening draft, because the plan *reacts*. Each persona is a simulated runner who follows (or doesn't follow) the plan week by week. Each Monday the plan is rebuilt from everything run so far, exactly as the race page does. The 15 personas cover what this user will plausibly do:

| persona | what they do |
|---|---|
| steady | runs every week as planned |
| holidays | Christmas / New Year weeks at 40% and 65% (inside your actual season) |
| flu-in-peak | a week off and a week at 30% in mid-February |
| mostly-there | busy job: about 80% of every week |
| overachiever | about 30% more than planned every week, "easy / fresh" |
| drained | two "hard / drained" check-ins in a row |
| niggle | "pain in one spot" after week 12 |
| bored | two "a chore" check-ins |
| late-start | adds the race 6 weeks out |
| one-week-later | adds the race a week later (16-week season) |
| low-base | about 8 mi/wk before the race |
| comeback | 3 weeks off for injury, adds the race the day they restart |
| high-base | about 40 mi/wk |
| marathon / five-k | other distances the goal form offers |

### Layer 2: deterministic checks (`checks.ts`)
Anything code can verify exactly is checked by code, never by the LLM. Each check cites the failing weeks.

- **Gates** (unsafe or broken if violated):
  - **SPIKE:** no week above 1.3× the 4-week average actually run.
  - **LONG_SHARE:** long run at most 35% of the week.
  - **LONG_STEP:** the long run grows by at most 1 mi a week.
  - **TAPER:** a real two-week taper.
  - **TAPER_VS_RECENT:** the taper never asks for more than was recently run.
  - **ONE_QUALITY:** at most one hard session a week.
  - **CHECKINS:** pain cuts the next week and removes speed work; "drained" never builds.
  - **NON_DEGENERATE:** every week plans at least 5 mi.
  - **NO_SPIRAL:** a runner doing at least 75% of every week doesn't see the plan fall below where they started.
  - **SPECIFICITY:** the long run reaches what the distance needs, and workouts are named for this distance.
- **Warnings:**
  - **CUTBACK_SPACING:** at most 3 build weeks in a row.
  - **TUNE_UP:** the build includes the time trial.
  - **NEW_IN_CUTBACK:** a workout type never debuts in a cutback week.
  - **CHURN:** future weeks don't jump after an on-plan week.

The checks are themselves tested (`checks.test.ts`). They pass the steady season and catch every planted defect in `mutations.ts`.

### Layer 3: LLM judge (`rubric.ts`, `judge.ts`, `run-judge.ts`)
The LLM judges only what needs judgment, against six anchored dimensions: the 5 / 3 / 1 descriptions are in `rubric.ts`.

| dimension | weight | question |
|---|---|---|
| Safety & load | 25% | Is every week defensible from what was actually run, with recovery built in and red flags respected? |
| Race specificity | 20% | Does it prepare for this distance, course and pace? |
| Adaptivity | 20% | Are responses to real life proportionate, and does the plan recover? |
| Sustainability & enjoyment | 15% | Would a busy runner follow it without stress? |
| Fit & honest feasibility | 10% | Does it suit this runner, and does it say so when the goal is a stretch? |
| Explainability | 10% | Is every number traceable, and are the explanations true? |

What makes the method rigorous rather than vibes:
- **Evidence before score.** For each dimension, the judge must list at least two observations with week numbers before scoring, and say what would make it a 5. The output is a structured schema (`JudgeVerdict`).
- **Facts can't be argued away.** Check results go to the judge as facts, and failed gates *cap* the related scores in code (`GATE_CAPS`), after the judge answers.
- **Repeat sampling.** Each season is judged 3 times; the report gives medians and flags spreads over 1 point as unreliable.
- **Blind calibration before trusting scores** (`--calibrate`). The judge compares the steady season against copies with one planted defect each (spike, no taper, half-length long runs, two hard sessions a week, short long runs, no cutbacks, no progression). It sees no check results, and the A/B order is swapped each time. It must pick the original on the defect's dimension. Below 90% accuracy, fix the rubric before reading any scores.
- **Judged for this runner as they behaved,** not an idealised athlete. The prompt also tells the judge not to reward confident or scientific-sounding explanations.

Run it:
```bash
npm run eval:plans:checks                       # free: simulate + checks, writes traces to evals/plan-judge/results/
npm run eval:plans:judge -- --calibrate         # dry run: prints call count and cost
npm run eval:plans:judge -- --yes --calibrate   # 59 calls on claude-opus-5-5, est. ≈ $8.60
```
The judge uses adaptive thinking at high effort, structured output, and the server-side refusal fallback.

> **Status of this review.** Layers 1 and 2 ran. Layer 3 did **not** run, because this session has no Anthropic API key. The scores below are mine: I applied the same rubric and caps to the same traces by hand. Run the command above to get the model's independent scores and the calibration accuracy.

---

## 2. Scorecard

My scores, 1–5, with gate caps applied. Weighted score out of 5.

| persona | safety | specificity | adaptivity | sustainability | fit | explain | weighted | failed gates |
|---|---|---|---|---|---|---|---|---|
| steady | 5 | 3 | 4 | 3 | 4 | 4 | **3.9** | none |
| bored | 5 | 3 | 4 | 4 | 4 | 4 | **4.05** | none |
| one-week-later | 5 | 3 | 4 | 3 | 4 | 4 | **3.9** | (warn) TUNE_UP, NEW_IN_CUTBACK |
| drained | 4 | 3 | 3 | 4 | 4 | 4 | **3.6** | none |
| late-start | 5 | 2 | 4 | 4 | 2 | 4 | **3.65** | SPECIFICITY |
| high-base | 3 | 4 | 4 | 4 | 3 | 4 | **3.65** | none |
| five-k | 5 | 2 | 4 | 4 | 3 | 2 | **3.55** | SPECIFICITY |
| low-base | 5 | 2 | 4 | 3 | 1 | 4 | **3.4** | SPECIFICITY |
| overachiever | 3 | 3 | 3 | 4 | 3 | 4 | **3.25** | none |
| niggle | 2 | 3 | 3 | 4 | 4 | 3 | **3.0** | CHECKINS |
| holidays | 5 | 2 | 2 | 2 | 3 | 2 | **2.85** | SPECIFICITY, (warn) CHURN |
| marathon | 4 | 1 | 4 | 3 | 1 | 2 | **2.75** | SPECIFICITY |
| flu-in-peak | 2 | 3 | 2 | 3 | 3 | 3 | **2.55** | SPIKE |
| comeback | 3 | 1 | 1 | 1 | 1 | 2 | **1.6** | TAPER, NON_DEGENERATE, SPECIFICITY |
| mostly-there | 2 | 1 | 1 | 1 | 1 | 3 | **1.45** | SPIKE, TAPER_VS_RECENT, NON_DEGENERATE, NO_SPIRAL, SPECIFICITY |

The pattern: **followers score about 3.6–4.0, and disrupted runners score about 1.5–3.** The rules for the happy path are good; the rules for re-planning are where the bugs are.

---

## 3. Findings, ranked

Each finding names the code, the persona that exposed it, and a concrete fix.

### Critical

**F1. After a break, the plan is zero for the whole season.** `lib/racePlan.ts:491-492, 511, 612-615`
*Seen in: comeback.* The baseline is the median of the last 4 weeks. With three empty weeks the median is 0, so every target is 0 (`0 × 1.08 = 0`). It never recovers: when the runner runs, "back up to" is capped by `highRef`, which is also 0. A runner adding the race right after an injury break gets 17 weeks of "0 mi".
*Fix:* floor the baseline at the larger of a minimum week (about 9 mi, matching the 7-day plan's minimum) and a share of the last 8–12 weeks' non-zero average, then use the return ladder. Never let `highRef` sit below what was actually run.

**F2. Running about 80% of every week makes the plan spiral to nothing.** `lib/racePlan.ts:621-623`
*Seen in: mostly-there.* Each short week re-plans from what was run (`ref = ran`), then builds 8%. That's ×0.864 per week, so 21.6 mi in week 1 becomes 3.2 mi in week 15. The peak weeks then ask for "3 × 2 mi at race pace" inside a 3.2-mile week, and the long run is 1.1 mi. A real person would likely keep running about 16–17 mi and ignore the app, which is how trust in the plan gets lost.
*Fix:* re-plan from what the runner *sustains*, e.g. `max(ran, 0.9 × 4-week average run)`, and treat 75–90% as "partly done: hold" rather than "shrink". Missed miles still aren't made up, but the plan converges to what you actually run instead of falling below it.

**F3. The taper can jump far above recent training.** `lib/racePlan.ts:378-383, 589`
*Seen in: flu-in-peak, mostly-there, niggle.* When the season is re-planned during the taper, `peak` is empty and the taper steps down from `priorPeak`: the highest *planned* week ever, even one never run. After the flu (weeks at 0, 4.5 and 15 mi), the taper asks for 21 mi (1.9× the 4-week average). For the 80% runner it asks for 15 mi after 3.7. The return ladder is also switched off in taper weeks (`phase !== 'taper'`).
*Fix:* taper from `min(planned peak, highest week actually run in the last 3–4 weeks)`, and let a return ladder finish inside the taper.

**F4. Every distance gets half-marathon training.** `lib/racePrinciples.ts` (`longPeakKm`, `taperWeeks`), `lib/racePlan.ts:237-263, 441`
*Seen in: marathon, five-k.* The goal form offers 5K, 10K, half and marathon, but the plan is hard-wired for the half:
- marathon long runs stop at 13 mi (they need 18–20) and the trail says "Half-marathon long-run ceiling";
- a 5K plan gets "Half-marathon pace" workouts, a 10K tune-up and a 2-week taper.

Race week is also planned *below* the race distance (marathon: 18.8 mi planned for a 26.2-mi race week).
*Fix:* a distance profile per race type (long-run peak, workouts, tune-up distance, taper length), chosen from `goal.distance`. Until then, only build race plans for half-marathon goals.

### High

**F5. Two holiday weeks permanently cost about a quarter of the peak.** `lib/racePlan.ts:418-426, 590-610`
*Seen in: holidays (inside your real season).* One 40% week triggers the full 4-step ladder (50 → 75 → 90 → 100%). The load-ratio cap then trims each step, because the 4-week average still contains the holiday. When the ladder ends, the build resumes from the *trimmed* number. Result: peak 30 → 22.8 mi, long run 11 → 8 mi. The runner did everything asked from January on and still sees "Peak lowered". Two weeks at reduced volume cost little fitness (detraining under about 2 weeks is minimal); the plan treats it like a layoff.
*Fix:* make the ladder length proportional to the missed time (one reduced week → one step back), resume from the pre-break reference rather than the trimmed one, and let a planned ladder count as the load reference so the two guards don't stack.

**F6. Pain right after a cutback week doesn't cut anything.** `lib/racePlan.ts:427-431`
*Seen in: niggle.* Pain caps next week at `ref × 0.8`, and `ref` is the pre-cutback build reference. After a 24-mi cutback week with calf pain, the next week is planned at 24 mi again, with speed work correctly removed. The `CHECKINS` gate fails.
*Fix:* cap at 80% of *last week* (planned or run, whichever is lower).

**F7. The 7-day tile and the race page disagree.** `lib/trainingPlan.ts` (its own +10% and cutback cadence) + `min()` in `planNextWeek`
*Seen in: steady, via `evals/plan-judge/tile-vs-plan.ts`.* In weeks 1–3 the tile says "Cutback week" at 14–17 mi while the race page says to build from 21.6 to 25.2. After every race-plan cutback, the tile lags 15–20% for a week. Two different "this week" numbers is the opposite of low-stress.
*Fix:* when a race plan exists, the tile takes the week target and phase from it. The tile keeps only the day-by-day layout and its load-ratio safety net, and plans *the rest of this calendar week* rather than a rolling 7 days.

**F8. Race week counts the race inside its total.** `lib/racePlan.ts:378-386`
*Seen in: steady, low-base, marathon.* Race week is 50% of peak *including* the race. Steady: 15 mi total, 13.1 of it the race, so 1.9 mi for Monday to Saturday. Low-base: 6 mi planned, less than the race itself.
*Fix:* plan race week as about 3 short easy runs (25–35% of peak) *plus* the race, and show them separately.

### Medium

**F9. Cutbacks follow the calendar, not the build.** `lib/racePlan.ts:150-151, 346`
*Seen in: drained.* A cutback forced by two drained weeks (week 11) is followed by the scheduled one (week 12), so two down weeks in a row. After a return ladder, a cutback can land after only one build week.
*Fix:* count build weeks since the last down week, not `(i + 1) % 4`.

**F10. The 5K time trial disappears in some seasons; tempo starts in a cutback week.** `lib/racePlan.ts:207-236`
*Seen in: one-week-later, marathon.* If build week 3 is a cutback (a 16-week season), the time trial is silently skipped and tempo debuts in the cutback week.
*Fix:* put the time trial in the first non-cutback build week from week 2, and never debut a workout type in a cutback week.

**F11. Workouts don't scale with the week.** `lib/racePlan.ts:227-228, 247, 360`
Race-pace blocks are fixed in miles (up to 6 mi), so they exceed the week when volume is low (F2). Tempo is capped at 10% using *last week's* reference and rounded down, so most recreational runners do 2 × 1 mi all build and it never progresses.
*Fix:* size workouts as a share of the week (threshold ≤ 10%, race pace ≤ 15–20%), progress the share, and compute from this week's target.

**F12. No honesty about feasibility.** *Seen in: low-base, late-start, marathon.* The newer runner peaks at 12 mi/wk with a 4.2-mi long run for a 13.1-mi race, and nothing says so.
*Fix:* a feasibility line on the race page ("At your base this plan reaches an X-mi long run. Options: run-walk, a later race, or a finish-time goal"). The rule list makes this easy: it's one more principle with an evidence label.

**F13. The peak phase is a flat line.** *Seen in: steady.* The 30-mi cap is hit in week 11 and held for weeks 13–15, and the long run is stuck at 10.5 mi because the 35% share binds. The peak adds race-pace work but no long-run progression.
*Fix:* for a half at under 35 mi/wk, allow the long run up to 40% in the peak (Higdon-style), or size the peak so the needed long run fits.

**F14. Change-log explanations name the wrong cause.** `lib/racePlan.ts:535-566`
*Seen in: holidays.*
- "Peak lowered 30 → 22.8. Week 8 ran 18.6 of 18.6. Missed miles aren't made up". Week 8 was run in full; the cause was the load-ratio trim.
- "Week 16 raised" cites the flex band and a check-in; the real reason is a new taper base.

The text lists whichever reactive rules fired, and the peak message is hard-coded.
*Fix:* record the cause at the point a number is changed (each adjustment pushes a `cause` with before/after), and build the change log from those causes. That's traceability you can trust.

**F15. The experienced runner goes from 40 to 60 mi/wk for a half in 11 weeks.** `lib/racePlan.ts:493-494`
1.5× is a lot at higher volume.
*Fix:* tier the multiplier (≈1.5× under 25 mi/wk, ≈1.25× above 35), and only reuse a prior peak from the last 6 months.

**F16. Overshooting is invisible.** *Seen in: overachiever.* The runner runs 39 mi on a 30-mi plan with 12-mi long runs for months, and the app never mentions it. Not speeding the plan up is right; saying nothing isn't.
*Fix:* a gentle note after 2+ weeks above 120% ("the extra isn't making you faster; it's raising injury risk").

**F17. "One new thing at a time" stalls short seasons.** *Seen in: five-k (4 holds in 10 weeks).* Also, after a pain week every workout counts as "new" again, so the trail says "New this week: Fartlek", which is misleading.
*Fix:* cap holds per phase, and compare against the last week *with* sessions.

### Low

- **F18.** Season start uses the UTC date of `createdAt` (`lib/raceServer.ts:117`), and a goal added Tuesday–Saturday starts on that week's Monday, so week 1 is partly over before the plan exists. Use the local date and start the next Monday.
- **F19.** Uploaded files keep their own sport and `loadRaceData` doesn't filter by sport, so an uploaded ride would count as running miles.
- **F20.** Only the current week is load-checked (`:418`), so future weeks shown on the chart can be trimmed when they arrive. This is the CHURN warning.
- **F21.** The "drained" response needs effort "hard" *and* freshness "drained" (`:638`). "Medium / drained" (sleep, illness, stress) changes nothing. Freshness alone should trigger a hold.
- **F22.** Prediction: the heart-rate model keeps a fixed 40% weight even when it extrapolates 20+ bpm beyond any run (`lib/racePrediction.ts`). In the seeded demo it said 1:49 against Riegel's 1:58, pulling the blend about 4 min fast. Any run named "race" counts as a hard effort. Scale the weight by extrapolation distance, and require HR evidence for named races when HR exists.
- **F23.** `loadRaceData` loads every stream of every run on each page view, and the Analysis page now loads runs twice. Select only the last 120 days of streams.
- **F24.** There's no way to edit a goal. Changing the goal time means delete and re-add, which restarts the season (new `createdAt`) and loses the replayed history.

---

## 4. What it does well

- **The safety core holds for followers.** Steady, bored, drained and high-base pass every gate: builds of 8% or less, regular down weeks, load-ratio trims, long runs in proportion.
- **Determinism through replay.** Past weeks show the plan as it stood then, with no stored snapshots, so the whole season can be replayed and tested. That's what made this eval possible in about 300 lines.
- **Traceability is real.** Every number carries its rule, inputs and output; the rule list labels its evidence honestly ("debated" for the load ratio, "app choice" for the HR cap); the Guide is generated from the same file the code reads.
- **Check-ins work as designed in the common cases.** "Drained" holds; two "chore" weeks swap the workout for a free run; feeling great never speeds the plan up.
- **Overshooting doesn't accelerate the plan**, and the flex band counts close-enough weeks as done.
- **Introducing one new workout type at a time** (holding volume that week) is a good coaching rule, rarely implemented.
- **Privacy:** race data, check-ins and hints never reach the demo.

---

## 5. How it fits what you'll actually do

| what you'll do | how the plan handles it today |
|---|---|
| Add the NYC Half on a Sunday evening | Starts the next Monday. OK. (Tue–Sat: week 1 is partly over. F18) |
| Sync runs daily, open the race page on Mondays | Works; the plan updates every visit |
| Look at Analysis midweek | **Different number from the race page (F7)** |
| Christmas / New Year travel | **Costs about 25% of the peak (F5)** |
| Run about 80% of plan in a busy month | **Plan shrinks every week (F2)** |
| Get a cold or flu in February | **Taper jumps after you return (F3)** |
| Feel drained, sore or bored and check in | Mostly right; pain after a cutback is the gap (F6); "medium / drained" is ignored (F21) |
| Run an NYRR tune-up | Counts only if it's named "race" or your HR shows it was hard. Good |
| Add a second race (10K tune-up) as a goal | **Analysis follows the nearest goal, with half-marathon-style training for a 10K (F4)** |
| Change your goal time | Needs delete and re-add, which **restarts the season (F24)** |
| Know about travel in advance | No way to tell the plan; it can only react afterwards |
| Race on Sunday | The long-run day is fixed to Saturday. Fine, but NYRR races are often Saturday or Sunday and can't swap |

The structure (rules file → deterministic planner → replay → UI trail) is the right shape. The gaps are inputs it can't receive (planned travel, goal edits, run-type tags, preferred days) and re-plan rules that compound.

---

## 6. What I'd do next, in order

1. **Fix F1–F3 and F6** in `racePlan.ts` (each is small). Turn their gates in `checks.ts` into regression tests, so every persona must pass them.
2. **One number per week (F7, F8):** the tile follows the race plan, and race week is easy runs plus the race.
3. **Proportionate disruption handling (F5, F9, F20):** ladder length scaled to the gap, cutbacks counted from builds, future weeks load-checked against the planned season.
4. **Distance profiles (F4) and a feasibility line (F12)**, or restrict race plans to half marathons until then.
5. **Cause-based change log (F14).**
6. **Run the LLM judge with `--calibrate`**, then use it as the before/after gate for every planner change: a change ships only if the gates pass and no persona's median score drops.

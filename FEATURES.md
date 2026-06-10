# Feature Reference — Coaching-First Analysis

This file stores the full analysis of Strava and Garmin features through the lens of a marathon coach.
Use this as a backlog when planning future waves or expansions.

---

## What Each Platform Provides

### Strava (subscription features)
- Training Log — cumulative mileage visualized over time
- Grade Adjusted Pace (GAP) — effort-normalized pace on hilly routes
- Heart Rate Zones — time in each zone per activity
- Training Zones — zone distribution across weeks/periods
- Matched Activities — benchmark the same route across different dates
- Performance Predictions — AI-estimated finish times for 5K, 10K, HM, marathon, updated after every run
- Athlete Intelligence — AI narrative summaries of training patterns
- Relative Effort — per-activity load score derived from heart rate

### Garmin Connect (via watch + app)
- VO2 max — running-specific, heat/altitude adjusted
- Training Status — classifies fitness as Peaking / Productive / Maintaining / Recovery / Overreaching / Detraining
- Training Load — acute load score + 4-week load focus (base / tempo / anaerobic split)
- Recovery Time — estimated hours until ready for next hard effort
- HRV Status — daily readiness signal from heart rate variability
- Body Battery — daily energy reserve (0–100)
- Resting Heart Rate trends
- Running Dynamics — cadence, stride length, vertical oscillation, ground contact time, vertical ratio
- Race Time Predictions — pace-based finish time estimates
- Performance Condition — real-time fitness vs. baseline mid-run
- Sleep Score, Stress levels
- Garmin Coach — adaptive training plans

---

## Feature Priority for a Marathon Coach

### Tier 1 — Essential (coach checks these every week)

| Feature | Why |
|---|---|
| Weekly mileage + load trend | Volume progression is the foundation of marathon training. Spot dangerous spikes before injury. |
| Training status / recovery time | Most actionable daily signal — is the athlete ready for today's key session? |
| Zone distribution (easy vs. hard %) | Most athletes run easy days too hard. Verifying 80% low-intensity is central to polarized training. |
| Consistency calendar | Missing runs compounds over 16 weeks. A coach needs the full picture, not just last week. |
| Goal progress vs. race target | Continuous "are we on track" signal — mileage goal + performance prediction trending toward goal time. |

### Tier 2 — High coaching value

| Feature | Why |
|---|---|
| HRV / Body Battery trend | Early warning for accumulated fatigue or illness before it degrades performance. 5 consecutive low HRV days = pull back load. |
| VO2 max trend | Clearest long-term fitness progression signal. Should trend up through the block and plateau at taper. |
| Matched Activities | Showing athletes the same route getting faster over a training cycle is motivationally powerful. |
| Route maps | Verify the athlete ran prescribed terrain; understand elevation and conditions. |

### Tier 3 — Useful but secondary

| Feature | Why |
|---|---|
| Running dynamics | Form work addressed in dedicated sessions, not weekly check-ins. |
| All-runs heatmap | Engaging but not a coaching tool. |
| Segment leaderboards | Can encourage athletes to race on recovery days — handle carefully. |
| Performance predictions (race finish times) | Useful but a Tier 1 derived output, not a standalone feature. |

---

## Backlog Ideas (Future Waves)

- Athlete-facing dashboard with coach comments / feedback per activity
- Load ratio alert — flag when acute/chronic load ratio exceeds 1.3 (injury risk zone)
- HRV trend chart overlaid with training load
- VO2 max progression chart
- Matched Activities view — same route compared across dates
- Weekly zone distribution chart (easy / moderate / hard % breakdown)
- Race goal setup with predicted finish time tracking
- Running dynamics charts (cadence, stride length over time)
- Coach notes / annotation on individual activities
- Multi-athlete view (if expanded beyond single user)

import { KM_PER_MILE } from '@/lib/units'

// The rules behind the race plan and the race-time projection, in one place.
//
// lib/racePlan.ts and lib/racePrediction.ts read every number they use from
// this file, and the Guide's "Rules behind the race plan" table is rendered
// from PRINCIPLES. So the explanation can't drift from what the code does:
// change a value here and the plan, the decision trail and the Guide all move.
//
// Evidence levels are deliberately honest:
//   research   — supported by controlled studies or meta-analyses
//   debated    — studied, but researchers disagree; kept as a guard rail
//   consensus  — shared by the major coaching books, not proven in trials
//   app        — a judgement call made in RONR

export type Evidence = 'research' | 'debated' | 'consensus' | 'app'

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  research: 'Research-backed',
  debated: 'Research · debated',
  consensus: 'Coaching consensus',
  app: 'App choice',
}

export const EVIDENCE_HELP: Record<Evidence, string> = {
  research: 'Supported by controlled studies or meta-analyses.',
  debated: 'Studied, but researchers disagree. Kept as a guard rail, not a law.',
  consensus: 'Shared by the major training plans, not proven in trials.',
  app: 'A judgement call in RONR.',
}

const mi = (miles: number) => miles * KM_PER_MILE

// ── Numbers (the only place they are defined) ──────────────────────────

export const RULES = {
  baselineWeeks: 4, // median of the last N complete weeks
  buildRate: 0.08, // +8% per build week
  cutbackEvery: 4, // every 4th plan week
  cutbackRate: 0.8, // cutback week = 80% of the build reference
  cutbackQualityShare: 0.5, // halve the workout in a cutback week
  peakMultiple: 1.5, // peak ≤ 1.5 × baseline (or last year's top week)
  loadRatioMax: 1.3, // next week ≤ 1.3 × average of the last 4 weeks
  flexBand: 0.1, // ±10% of the target counts as "on plan"
  restartShare: 0.5, // a week under half the plan restarts the build at half
  longShare: 0.35, // long run ≤ 35% of the week (half-marathon plans at lower mileage)
  longStepKm: mi(1), // long run grows ≤ 1 mi per week
  longPeakKm: mi(13), // half-marathon long run peaks at 13 mi
  longCutbackRate: 0.7,
  taperRates: [0.7, 0.5], // last two weeks as a share of peak (race week includes the race)
  taperWeeks: 2,
  peakWeeks: 3,
  maxBuildWeeks: 6,
  thresholdShare: 0.1, // ≤ 10% of the week at threshold pace
  easyShare: 0.8,
  easyHrCap: 156, // same cap as the 7-day plan (lib/trainingPlan.ts HR_CAP)
  checkInPainCut: 0.8, // pain in one spot → next week at 80%, no workout
  lowEnjoymentWeeks: 2,
  // Prediction
  qualifyingWindowDays: 90,
  minEffortKm: 5, // never stretch an effort shorter than 5K to a half
  riegelK: { high: 1.06, low: 1.08, highMileageKm: mi(40), lowMileageKm: mi(20) },
  hmHrShare: 0.88, // half-marathon effort ≈ 85–90% of max HR
  hrModelDays: 56,
  hrModelMinRuns: 6,
  blendWeights: { riegel: 0.6, hr: 0.4 },
  rangePct: { high: 0.02, medium: 0.03, low: 0.05 },
  gainPerWeek: 0.003, // "if training goes to plan": ≤ 0.3% per remaining training week…
  gainMax: 0.03, // …capped at 3%
} as const

// ── The rules, as shown in the decision trail and the Guide ────────────

export interface Principle {
  id: string
  title: string
  says: string
  value: string
  evidence: Evidence
  note?: string
  sources: string[]
}

const pct = (x: number) => `${Math.round(x * 100)}%`

const list: Principle[] = [
  {
    id: 'BASELINE',
    title: 'Start from what you actually run',
    says: `The plan starts from the median of your last ${RULES.baselineWeeks} complete weeks, so one big or missed week doesn't skew it.`,
    value: `${RULES.baselineWeeks}-wk median`,
    evidence: 'app',
    sources: ['RONR'],
  },
  {
    id: 'PHASES',
    title: 'Base → build → peak → taper',
    says: 'Easy volume first, then threshold work, then race-specific work, then a taper.',
    value: `peak ${RULES.peakWeeks} wk · taper ${RULES.taperWeeks} wk`,
    evidence: 'consensus',
    sources: ['Lydiard periodization', 'Daniels’ Running Formula', 'Pfitzinger & Douglas, Faster Road Racing'],
  },
  {
    id: 'BUILD_STEP',
    title: 'Build gradually',
    says: 'Raise weekly volume a little at a time.',
    value: `+${pct(RULES.buildRate)}/wk`,
    evidence: 'consensus',
    note: 'The “10% rule” itself is folklore; a gradual build is the consensus. Nielsen 2014 found no extra injury risk at ~10%, but more above ~30%.',
    sources: ['Daniels’ Running Formula', 'Pfitzinger & Douglas', 'Nielsen et al. 2014, JOSPT'],
  },
  {
    id: 'CUTBACK_CADENCE',
    title: 'Cut back every fourth week',
    says: `Every ${RULES.cutbackEvery}th week drops to ${pct(RULES.cutbackRate)} so the body absorbs the work.`,
    value: `wk ${RULES.cutbackEvery}, ${RULES.cutbackEvery * 2}, … at ${pct(RULES.cutbackRate)}`,
    evidence: 'consensus',
    sources: ['Pfitzinger & Douglas', 'Hansons Half-Marathon Method'],
  },
  {
    id: 'PEAK_CAP',
    title: 'A modest peak',
    says: `Peak at most ${RULES.peakMultiple}× your baseline, or your highest week of the last year if that's more.`,
    value: `≤ ${RULES.peakMultiple}× baseline`,
    evidence: 'app',
    note: 'Prior fitness comes back faster than new volume is built.',
    sources: ['RONR', 'Daniels’ Running Formula'],
  },
  {
    id: 'LOAD_RATIO_MAX',
    title: 'No spikes',
    says: `Next week is at most ${RULES.loadRatioMax}× your average of the last 4 weeks.`,
    value: `≤ ${RULES.loadRatioMax}`,
    evidence: 'debated',
    note: 'Impellizzeri et al. 2020 question the acute:chronic ratio; it stays as a guard rail.',
    sources: ['Gabbett 2016, Br J Sports Med', 'Impellizzeri et al. 2020'],
  },
  {
    id: 'NO_MAKEUP',
    title: 'Missed miles stay missed',
    says: 'A short week is never made up later; the next weeks re-plan from what you actually ran.',
    value: '—',
    evidence: 'consensus',
    sources: ['Daniels’ Running Formula', 'Hudson, Run Faster'],
  },
  {
    id: 'FLEX_BAND',
    title: 'Close enough counts',
    says: `Anything within ±${pct(RULES.flexBand)} of the target counts as a full week. Running more can bring the plan back to where it was before a missed week, never past it.`,
    value: `±${pct(RULES.flexBand)}`,
    evidence: 'app',
    sources: ['RONR'],
  },
  {
    id: 'RESTART',
    title: 'Restart gently after a broken week',
    says: `A week under ${pct(RULES.restartShare)} of the plan (illness, travel) restarts at 50% of where you were, then 75 → 90 → 100% over the next weeks. Another broken week starts the ladder over; it never compounds.`,
    value: '50 → 75 → 90 → 100%',
    evidence: 'consensus',
    sources: ['Daniels’ Running Formula (return after time off)', 'Same ladder as the 7-day plan'],
  },
  {
    id: 'LONG_RUN_SHARE',
    title: 'Long run in proportion',
    says: `The long run is at most ${pct(RULES.longShare)} of the week and grows by at most 1 mi a week.`,
    value: `≤ ${pct(RULES.longShare)} · +1 mi`,
    evidence: 'consensus',
    note: 'Half-marathon plans at lower mileage (Higdon, Hansons) run a bigger share than marathon plans.',
    sources: ['Higdon half-marathon plans', 'Hansons Half-Marathon Method'],
  },
  {
    id: 'LONG_RUN_PEAK',
    title: 'Long run peaks three weeks out',
    says: 'For a half, the long run tops out around 11–13 mi in the last peak week.',
    value: '≤ 13 mi',
    evidence: 'consensus',
    sources: ['Pfitzinger & Douglas', 'Higdon'],
  },
  {
    id: 'TAPER',
    title: 'Taper: less volume, keep intensity',
    says: 'Cut volume over the final two weeks while keeping some race-pace running.',
    value: RULES.taperRates.map(pct).join(' → '),
    evidence: 'research',
    sources: ['Bosquet et al. 2007, Med Sci Sports Exerc (meta-analysis)', 'Mujika & Padilla 2003'],
  },
  {
    id: 'INTENSITY_MIX',
    title: 'Mostly easy',
    says: 'About 80% of running is easy; one quality session a week at most.',
    value: `${pct(RULES.easyShare)} easy`,
    evidence: 'research',
    sources: ['Seiler 2010, IJSPP', 'Stöggl & Sperlich 2014'],
  },
  {
    id: 'ONE_NEW_STRESSOR',
    title: 'One new thing at a time',
    says: 'The week a new workout type starts, volume holds instead of rising.',
    value: 'hold',
    evidence: 'consensus',
    sources: ['Hudson, Run Faster'],
  },
  {
    id: 'STRIDES',
    title: 'Strides all season',
    says: '4–6 × 20 s quick, relaxed strides after an easy run, twice a week.',
    value: '2×/wk',
    evidence: 'consensus',
    sources: ['Daniels’ Running Formula', 'Hudson, Run Faster'],
  },
  {
    id: 'HILL_SPRINTS',
    title: 'Hill sprints in base',
    says: '6–10 × 8 s near-max up a steep hill, full recovery. Builds strength cheaply; NYC Half has bridge and park climbs.',
    value: '1×/wk',
    evidence: 'consensus',
    sources: ['Hudson, Run Faster'],
  },
  {
    id: 'FARTLEK',
    title: 'Fartlek opens the build',
    says: '1-minute surges at 10K effort with easy jogs: a gentle first step into faster running.',
    value: '6–10 × 1 min',
    evidence: 'consensus',
    sources: ['Lydiard', 'Higdon'],
  },
  {
    id: 'THRESHOLD_CAP',
    title: 'Threshold in measured doses',
    says: `Tempo work at threshold pace, at most ${pct(RULES.thresholdShare)} of the week.`,
    value: `≤ ${pct(RULES.thresholdShare)}`,
    evidence: 'consensus',
    sources: ['Daniels’ Running Formula'],
  },
  {
    id: 'RACE_PACE',
    title: 'Race-pace work in the peak',
    says: 'Growing blocks at half-marathon pace, plus a fast finish on some long runs.',
    value: '2×2 → 2×3 mi',
    evidence: 'consensus',
    sources: ['Hansons Half-Marathon Method', 'Pfitzinger & Douglas'],
  },
  {
    id: 'TUNE_UPS',
    title: 'Tune-ups sharpen the projection',
    says: 'A 5K time trial in the build and a 10K race in the peak replace that week’s workout.',
    value: '2 per season',
    evidence: 'consensus',
    sources: ['Pfitzinger & Douglas', 'Daniels’ Running Formula'],
  },
  {
    id: 'CUTBACK_QUALITY',
    title: 'Lighter workouts in cutback weeks',
    says: 'A cutback week halves the workout; strides stay.',
    value: pct(RULES.cutbackQualityShare),
    evidence: 'consensus',
    sources: ['Pfitzinger & Douglas'],
  },
  {
    id: 'EASY_HR_CAP',
    title: 'Easy runs stay easy',
    says: 'Easy and long runs stay under a heart-rate cap. Workout days are exempt but still count toward load.',
    value: `${RULES.easyHrCap} bpm`,
    evidence: 'app',
    sources: ['MAF method (Maffetone)', 'RONR'],
  },
  {
    id: 'CHECKIN',
    title: 'How you feel adjusts the plan',
    says: 'A hard, drained week holds the next one; pain in one spot cuts it and drops the workout. Feeling great never speeds the plan up.',
    value: 'weekly check-in',
    evidence: 'research',
    note: 'How you feel is a better early warning than load numbers alone. The exact adjustments are app choices.',
    sources: ['Saw, Main & Gastin 2016, Br J Sports Med (systematic review)', 'Hooper & Mackinnon 1995'],
  },
  {
    id: 'KEEP_IT_FUN',
    title: 'Keep it fun',
    says: `${RULES.lowEnjoymentWeeks} low-enjoyment weeks in a row swap one workout for a free run: new route, friends, no watch.`,
    value: 'free run',
    evidence: 'app',
    sources: ['RONR'],
  },
  // Prediction
  {
    id: 'QUALIFYING_EFFORT',
    title: 'Only real efforts predict races',
    says: `Only hard efforts of ${RULES.minEffortKm} km or more from the last ${RULES.qualifyingWindowDays} days count: high heart rate over the stretch, or a run named as a race or time trial.`,
    value: `≥ ${RULES.minEffortKm} km · hard`,
    evidence: 'app',
    sources: ['RONR'],
  },
  {
    id: 'RIEGEL_K',
    title: 'Riegel, adjusted for mileage',
    says: 'Time scales with distance to the power k; lower-mileage runners slow more over longer races, so k rises.',
    value: `${RULES.riegelK.high} → ${RULES.riegelK.low}`,
    evidence: 'research',
    sources: ['Riegel 1981, American Scientist', 'Vickers & Vertosick 2016, BMC Sports Sci Med Rehabil'],
  },
  {
    id: 'HR_PACE_MODEL',
    title: 'Heart rate vs. pace',
    says: `Fit pace against heart rate on your recent runs and read off the pace at ~${pct(RULES.hmHrShare)} of max HR, a typical half-marathon effort.`,
    value: `${pct(RULES.hmHrShare)} max HR`,
    evidence: 'consensus',
    note: 'Extrapolates from easy runs, so it carries less weight than a real effort.',
    sources: ['Daniels’ Running Formula (intensity vs. %HRmax)'],
  },
  {
    id: 'BLEND',
    title: 'Blend, then give a range',
    says: 'Methods are weighted and shown as a range, not one false-precise number.',
    value: `${pct(RULES.blendWeights.riegel)} / ${pct(RULES.blendWeights.hr)}`,
    evidence: 'app',
    sources: ['RONR'],
  },
  {
    id: 'PROJECTED_GAIN',
    title: 'Conservative race-day estimate',
    says: `“If training goes to plan” assumes at most ${(RULES.gainPerWeek * 100).toFixed(1)}% per remaining week, capped at ${pct(RULES.gainMax)}.`,
    value: `≤ ${pct(RULES.gainMax)}`,
    evidence: 'app',
    sources: ['RONR'],
  },
]

export const PRINCIPLES: Record<string, Principle> = Object.fromEntries(list.map(p => [p.id, p]))
export const PRINCIPLE_LIST = list

export type PrincipleId = (typeof list)[number]['id']

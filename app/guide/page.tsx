import Image from 'next/image'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import OpenFromHash from './OpenFromHash'

export const metadata = {
  title: 'How RONR Works — Running Dashboard',
  description: 'What the running dashboard shows, how to read every chart, and a simple weekly routine.',
}

const toc = [
  { id: 'start', label: 'Start here' },
  { id: 'idea', label: 'The idea' },
  { id: 'terms', label: 'Key terms' },
  { id: 'pages', label: 'The pages' },
  { id: 'charts', label: 'Analysis charts' },
  { id: 'routine', label: 'Weekly routine' },
]

// Public pages have no nav bar, so visitors get their own header.
function PublicHeader() {
  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img src="/favicon.ico" alt="" className="h-6 w-6" />
          <span className="text-sm font-bold tracking-widest text-zinc-900">RONR</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm text-zinc-600 hover:text-zinc-900 px-3 py-1.5 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/demo"
            className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            Try the demo
          </Link>
        </div>
      </div>
    </header>
  )
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        {intro && <p className="text-sm text-zinc-500 mt-0.5">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

function Screenshot({ src, alt, height }: { src: string; alt: string; height: number }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1600}
      height={height}
      sizes="(min-width: 1024px) 720px, 100vw"
      className="w-full h-auto rounded-xl border border-zinc-200"
    />
  )
}

function Page({
  name,
  href,
  shot,
  children,
}: {
  name: string
  href: string
  shot?: { src: string; alt: string; height: number }
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-zinc-900">{name}</h3>
        <Link href={href} className="text-xs text-zinc-500 hover:text-zinc-900 shrink-0">
          Open →
        </Link>
      </div>
      <div className="text-sm text-zinc-600 leading-relaxed space-y-2">{children}</div>
      {shot && <Screenshot {...shot} />}
    </div>
  )
}

/** One chart explanation: collapsed by default, with what a good reading looks like. */
function Chart({ id, name, want, children }: { id: string; name: string; want: string; children: React.ReactNode }) {
  return (
    <details id={id} className="group scroll-mt-20 bg-white rounded-xl border border-zinc-200 open:shadow-sm">
      <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <svg
          className="h-3 w-3 text-zinc-400 transition-transform group-open:rotate-90 shrink-0"
          viewBox="0 0 16 16"
          aria-hidden
        >
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="text-sm font-medium text-zinc-900 flex-1 min-w-[9rem]">{name}</span>
        {/* Wraps under the name on narrow screens */}
        <span className="text-xs text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 ml-6 sm:ml-0">
          Want: {want}
        </span>
      </summary>
      <div className="px-4 pb-4 pl-10 text-sm text-zinc-600 leading-relaxed space-y-2">{children}</div>
    </details>
  )
}

function ChartGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">{title}</h3>
      {children}
    </div>
  )
}

const terms: [string, React.ReactNode][] = [
  ['Aerobic base', 'Your ability to run far at a low, comfortable effort. Speed is built on top of it.'],
  ['MAF', 'Your aerobic ceiling: 180 − your age, in beats per minute. At or below it counts as easy.'],
  ['Zone 2', 'The 10 beats just below MAF. A genuinely easy, conversational effort.'],
  ['Hard', 'Heart rate at or above 87% of your max (220 − age, or your highest recorded if higher).'],
  ['TRIMP', 'A training-stress score per run: minutes × how hard your heart worked. Hard minutes count extra.'],
  ['Fitness / Fatigue / Form', 'Your 42-day load (CTL), 7-day load (ATL), and the difference between them (TSB).'],
  ['Load ratio', 'This week’s load ÷ your 6-week base. 0.8–1.3 is a safe build.'],
  ['Segment', 'A stretch of road many of your runs share, timed on every pass.'],
]

export default async function GuidePage() {
  const session = await getServerSession(authOptions)

  const content = (
    <div className="lg:grid lg:grid-cols-[11rem_1fr] lg:gap-10">
      <OpenFromHash />
      <nav aria-label="On this page" className="hidden lg:block">
        <ul className="sticky top-20 space-y-1 text-sm">
          {toc.map(t => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="block py-1 text-zinc-500 hover:text-zinc-900 transition-colors">
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-12 max-w-3xl min-w-0">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-zinc-900">How RONR works</h1>
          <p className="text-zinc-600 leading-relaxed">
            RONR is a personal running dashboard. It reads the runs from your GPS watch and answers
            one question every week: <strong>is my aerobic base growing, without getting hurt?</strong>{' '}
            You never log anything by hand. Just run, then check in here.
          </p>
          {!session && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/demo"
                className="text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-700 rounded-lg px-4 py-2 transition-colors"
              >
                Try the demo
              </Link>
              <span className="text-sm text-zinc-500 self-center">
                No sign-up: a read-only sample of real runs in New York City.
              </span>
            </div>
          )}
          {/* Contents for small screens, where the sticky sidebar is hidden */}
          <div className="flex flex-wrap gap-2 lg:hidden pt-2">
            {toc.map(t => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="text-xs text-zinc-600 border border-zinc-200 bg-white rounded-full px-3 py-1"
              >
                {t.label}
              </a>
            ))}
          </div>
        </div>

        <Section id="start" title="Start here" intro="Three steps, in this order.">
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              {
                n: 1,
                title: 'Get your runs in',
                body: 'On the Runs page, click Sync Intervals.icu to pull runs from Garmin or Strava, or Upload GPX / FIT to add files from your watch. The demo already has runs loaded.',
              },
              {
                n: 2,
                title: 'Open one run',
                body: 'Click any run for its route, weather and Deep Dive: heart rate, pace and elevation through the run. Ask: was the effort what I meant it to be?',
              },
              {
                n: 3,
                title: 'Check the trends weekly',
                body: 'Open Analysis once a week. Each chart has a ? that brings you back here to explain it.',
              },
            ].map(s => (
              <li key={s.n} className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">
                  {s.n}
                </span>
                <p className="text-sm font-semibold text-zinc-900">{s.title}</p>
                <p className="text-sm text-zinc-600 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="idea" title="The idea behind the app">
          <div className="text-sm text-zinc-600 leading-relaxed space-y-3">
            <p>
              The best predictor of long-term running success is a strong <strong>aerobic base</strong>,
              built consistently and without injury. Speed comes from the base, not instead of it.
              Everything in the app serves three questions:
            </p>
            <ul className="space-y-2">
              <li>
                <strong>Is my aerobic engine improving?</strong> If your heart rate at a given pace drifts
                down over the months, it is.
              </li>
              <li>
                <strong>Am I training at the right intensities?</strong> Most runs should be genuinely easy.
                The most common mistake in distance running is running easy days too hard.
              </li>
              <li>
                <strong>Am I building load safely?</strong> Injuries usually come from ramping up faster than
                the body can adapt, and that ramp is measurable before it hurts you.
              </li>
            </ul>
          </div>
        </Section>

        <Section id="terms" title="Key terms" intro="Words you’ll see across the app.">
          <dl className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
            {terms.map(([term, def]) => (
              <div key={term} className="grid sm:grid-cols-[11rem_1fr] gap-1 sm:gap-4 px-4 py-3 text-sm">
                <dt className="font-medium text-zinc-900">{term}</dt>
                <dd className="text-zinc-600">{def}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-zinc-500">
            Heart-rate zones use the birthday in Settings, at your age on the day of each run, so last
            year’s runs keep last year’s zones. Without a birthday, the app uses shares of your highest
            recorded heart rate.
          </p>
        </Section>

        <Section id="pages" title="The pages" intro="A quick tour, in the order of the menu.">
          <Page
            name="Runs"
            href="/runs"
            shot={{ src: '/screenshots/runs-list.png', alt: 'Runs list with the activity sidebar', height: 1000 }}
          >
            <p>
              The log: every run with date, distance, time, pace and heart rate. Switch miles and
              kilometers at the top. This is also where you sync or upload new runs.
            </p>
            <p>
              The <strong>sidebar</strong> checks whether the habit is holding. The flame is your streak
              of Monday–Sunday weeks with at least one run; rest days never break it. Below it: your
              weekly goal ring, a month calendar of run days, and distance for the past 12 weeks.
            </p>
          </Page>

          <Page
            name="Run detail & Deep Dive"
            href="/runs"
            shot={{ src: '/screenshots/run-deep-dive.png', alt: 'Deep Dive heart-rate chart', height: 900 }}
          >
            <p>
              Click any run to see its route (green start, red finish) and the weather when you ran.
              The <strong>Deep Dive</strong> below tells the run’s story second by second:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Heart rate</strong> with your MAF band in green. Grey shading marks time spent
                walking or stopped.
              </li>
              <li>
                <strong>Pace</strong> (with grade-adjusted pace for hills), <strong>elevation</strong> and{' '}
                <strong>cadence</strong>.
              </li>
              <li>
                <strong>Time in zones</strong>: how the run split between easy, moderate and hard.
              </li>
              <li>
                <strong>Splits</strong> per mile or km, and any segments the run passed through.
              </li>
            </ul>
          </Page>

          <Page
            name="Heatmap"
            href="/runs/heatmap"
            shot={{ src: '/screenshots/heatmap.png', alt: 'Heatmap of GPS tracks', height: 1000 }}
          >
            <p>
              Every GPS track layered on one dark map; routes you run often glow brighter. It opens on
              the last 90 days around your most recent run, wherever that was. Drag the date slider to
              change the range, or click <strong>Reset to all time</strong>. Blue lines are your
              segments; click one to jump to it.
            </p>
          </Page>

          <Page
            name="Segments"
            href="/segments"
            shot={{ src: '/screenshots/segment-detail.png', alt: 'Segment efforts compared over the hill profile', height: 1250 }}
          >
            <p>
              The stretches you run most, even inside different routes. The app finds them by overlaying
              all your runs and spotting where many share the same path, then times every pass. Open a
              segment to see whether you’re getting faster at the same heart rate, and compare up to
              five efforts drawn over the hill profile.
            </p>
          </Page>

          <Page
            name="Analysis"
            href="/analysis"
            shot={{ src: '/screenshots/analysis.png', alt: 'Analysis page with weekly volume', height: 1250 }}
          >
            <p>
              Trends across many runs. The date slider at the top drives most charts (it starts at the
              last two weeks); the training-load charts at the bottom always use your full history.
              Every chart is explained <a href="#charts" className="underline">below</a>.
            </p>
          </Page>

          <Page
            name="Goals"
            href="/goals"
            shot={{ src: '/screenshots/goals.png', alt: 'Goals and personal records', height: 1000 }}
          >
            <p>
              Set a weekly goal (a number of runs or a distance) and race goals. For each race the app
              predicts your finish time from recent best efforts. Personal records from 1K to the
              marathon are found in your runs automatically.
            </p>
          </Page>

          <Page name="Settings" href="/settings">
            <p>
              Your birthday (which sets your heart-rate zones), the time zone used for days and weeks
              (Eastern unless you change it, so a late-evening run counts on the day you ran it), and
              your login history.
            </p>
          </Page>
        </Section>

        <Section id="charts" title="Analysis charts" intro="Click a chart to expand it. The green tag is what a good reading looks like.">
          <ChartGroup title="Volume & consistency">
            <Chart id="weekly-volume" name="Weekly Volume" want="steady, gentle growth">
              <p>
                Total distance, run count or average run length per calendar week. Fitness follows
                volume, and volume should grow gradually: the classic guideline is no more than about
                10% a week. Look for consistency first, growth second.
              </p>
            </Chart>
            <Chart id="long-run" name="Long Run Progression" want="stair-steps, no spikes">
              <p>
                The longest single run of each week over the last 16 weeks, the length of a typical
                marathon build. You want stair-step growth with occasional cut-back weeks, not a flat
                line and not a sudden jump.
              </p>
            </Chart>
          </ChartGroup>

          <ChartGroup title="Aerobic engine">
            <Chart id="aerobic-development" name="Aerobic Development" want="newer dots lower">
              <p>
                Every run as a dot: distance across, average heart rate up, colored blue (oldest) to red
                (newest). Newer, redder dots sitting lower than older ones at the same distance means the
                same work costs your heart less. That downward drift is aerobic fitness. Dots drifting
                upward point to fatigue or too much hard running.
              </p>
            </Chart>
            <Chart id="aerobic-efficiency" name="Aerobic Efficiency" want="rising line">
              <p>
                Meters per minute, per heartbeat: how much speed each heartbeat buys you. Rising means
                improving. Expect noise from run to run; judge the slope over weeks, not days.
              </p>
            </Chart>
            <Chart id="aerobic-pace" name="Aerobic Pace" want="rising line (faster)">
              <p>
                The average pace of your easy (Zone 2) runs only, with the axis flipped so up is faster.
                It leaves out workouts and races, so it isolates your cruising speed at low effort, the
                number that best predicts marathon potential.
              </p>
            </Chart>
          </ChartGroup>

          <ChartGroup title="Intensity">
            <Chart id="effort-distribution" name="Effort Distribution" want="≥ 75% easy">
              <p>
                Each week’s running time split into easy, moderate and hard, in hours or as a percentage.
                Time is classified second by second from heart rate, so an easy warm-up with a hard
                finish is split correctly. Roughly 75–80% of running should be easy. A thin green band
                usually means easy runs are being run too hard.
              </p>
            </Chart>
          </ChartGroup>

          <ChartGroup title="Form & conditions">
            <Chart id="running-form" name="Running Form" want="steady or slowly rising">
              <p>
                Cadence (steps per minute) and step length; speed is the two multiplied. Dots are runs,
                the line is a 28-day average. It defaults to easy runs only, so like is compared with
                like. A slowly rising cadence at the same effort is a good sign; a sudden drop in either
                can point to fatigue or a niggle.
              </p>
            </Chart>
            <Chart id="run-walk-split" name="Run / Walk Split" want="running share creeping up">
              <p>
                Each run’s full elapsed time classified from cadence and speed as running, walking or
                stopped, with a 28-day running share line. Warm-up and cool-down walks count as breaks;
                stops like traffic lights stay in. Alongside it, the longest continuous stretch of
                running. Useful when building up with run/walk intervals.
              </p>
            </Chart>
            <Chart id="weather" name="Performance vs. Weather" want="know your heat cost">
              <p>
                Aerobic efficiency against the feels-like temperature, with darker dots for muggier air
                (higher dew point). Heat and humidity slow everyone; this shows <em>your</em> cost, so a
                “slow” August run can be read as the strong effort it was.
              </p>
            </Chart>
          </ChartGroup>

          <ChartGroup title="This week (full history)">
            <Chart id="training-plan" name="Next 7 days" want="follow it, keep it easy">
              <p>
                A suggested week of easy runs for building your base. It grows last week by about 10%
                (never more than 130% of your 4-week average, so one big week isn’t built on). After
                three weeks that grew it takes a cutback week at 80%, then goes back to the level
                before the cutback and builds from there. After a break of a week or more it ramps
                back in at 50 → 75 → 90 → 100% of what you were doing before; a return week run well
                over its step repeats that step. It never drops below a minimum week of three
                30-minute runs.
              </p>
              <p>
                Run days are spread out, not fixed to weekdays: back-to-back days only appear in a
                steady week of four or more runs, never while you are returning from a break, and the
                long run sits on the weekend with a rest day after it. No single run is more than 10%
                longer, in distance, than your longest run of the last 30 days.
              </p>
              <p>
                <strong>How do you feel?</strong> The tags on the card adjust the week. Set one when
                something changes; it stays until you change it back.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Pain</strong> (foot, shin, knee, tendon). Mild: no build, alternate days,
                  runs of 30 minutes at most. Strong: two rest days from the day you set it, then a
                  week at 75% of last week with the same limits.
                </li>
                <li>
                  <strong>Leg soreness / tightness.</strong> Medium: no build, alternate days, no run
                  longer than your recent longest. High: one rest day and a 75% week as well.
                </li>
                <li>
                  <strong>Sleep.</strong> So-so: no build. Poor: no build, alternate days.
                </li>
                <li>
                  <strong>Tiredness / stress.</strong> Medium: no build. High: one rest day, no build,
                  alternate days.
                </li>
                <li>
                  <strong>Sick.</strong> Rest every day until you turn it off.
                </li>
              </ul>
              <p>
                With several tags set, the strictest of each applies. Pain that stays strong after
                the rest days is a reason to see a physio, not something the plan can fix.
              </p>
              <p>
                Every run is easy, under your MAF heart rate; walk when you need to stay under it. Open{' '}
                <strong>How this was set</strong> on the card to see the arithmetic.
              </p>
            </Chart>
            <Chart id="base-building" name="Base building" want="bars and long run creeping up">
              <p>
                The two things the plan is trying to grow: minutes of easy running per week (at or
                below your easy heart rate) and the length of your long run, over the last 8 weeks.
                The streak counts weeks in a row with three or more runs, because a base is built by
                showing up. Expect a dip every fourth week or so; that is the cutback.
              </p>
            </Chart>
          </ChartGroup>

          <ChartGroup title="Load & readiness (full history)">
            <Chart id="fitness-fatigue" name="Fitness & Fatigue" want="fitness rising, fresh for races">
              <p>
                Daily TRIMP drives three curves: <strong>Fitness</strong> (42-day average load) builds and
                fades slowly, <strong>Fatigue</strong> (7-day) spikes and fades fast, and{' '}
                <strong>Form</strong> is fitness minus fatigue. Negative form is normal while building;
                for a race you want fitness high and form positive. That’s what a taper is for.
              </p>
            </Chart>
            <Chart id="load-ratio" name="Acute : Chronic Load" want="context, not a target">
              <p>
                This week’s load divided by your 6-week base: how fast am I ramping up? Around 1 means
                this week looks like your recent weeks; well above 1 means a big jump. It describes
                your training. Research in runners has not shown it predicts injury, so it does not
                change the plan. How you feel does: see the check-in tags on{' '}
                <strong>Next 7 days</strong>.
              </p>
            </Chart>
          </ChartGroup>
        </Section>

        <Section id="routine" title="A simple weekly routine">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { when: 'After each run', what: 'Open its Deep Dive. Was the effort what you intended?' },
              {
                when: 'Once a week',
                what: 'Open Analysis. Enough easy (Effort Distribution)? Ramping safely (Acute : Chronic)? Consistent (Weekly Volume)?',
              },
              {
                when: 'Once a month',
                what: 'Widen the date range and look at Aerobic Efficiency and Aerobic Pace. Is the engine growing?',
              },
            ].map(r => (
              <div key={r.when} className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-1">
                <p className="text-sm font-semibold text-zinc-900">{r.when}</p>
                <p className="text-sm text-zinc-600 leading-relaxed">{r.what}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-zinc-600">If the answers are yes, keep going. Patience is the whole game.</p>
        </Section>

        {!session && (
          <div className="bg-zinc-900 rounded-2xl p-6 text-center space-y-3">
            <p className="text-white font-semibold">See it with real runs</p>
            <p className="text-sm text-zinc-300">Open the read-only demo. No account needed.</p>
            <Link
              href="/demo"
              className="inline-block text-sm font-medium text-zinc-900 bg-white hover:bg-zinc-100 rounded-lg px-4 py-2 transition-colors"
            >
              Try the demo
            </Link>
          </div>
        )}
      </div>
    </div>
  )

  if (session) return <AppShell isDemo={Boolean(session.isDemo)}>{content}</AppShell>
  return (
    <div className="min-h-screen bg-zinc-50">
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{content}</main>
    </div>
  )
}

export const metadata = {
  title: 'How to Use — Running Dashboard',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h2 className="text-base font-semibold text-zinc-900 mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-zinc-600 leading-relaxed">{children}</div>
    </section>
  )
}

function Chart({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-zinc-200 pl-4">
      <h3 className="text-sm font-semibold text-zinc-900 mb-1.5">{name}</h3>
      <div className="space-y-2 text-sm text-zinc-600 leading-relaxed">{children}</div>
    </div>
  )
}

export default function HowToUsePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">How to Use RUNNA</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          What everything means, and what to do about it
        </p>
      </div>

      <Section title="The idea behind this app">
        <p>
          RUNNA is built around one belief: the best predictor of long-term running success is a
          strong <strong>aerobic base</strong> — the ability to run far at a low, comfortable
          effort — built consistently, without getting injured. Speed comes from the base, not
          instead of it.
        </p>
        <p>
          Everything here serves three questions. <strong>Is my aerobic engine improving?</strong>{' '}
          If your heart rate at a given pace is drifting down over the months, it is.{' '}
          <strong>Am I training at the right intensities?</strong> Most runs should be genuinely
          easy — the most common mistake in distance running is doing easy runs too hard.{' '}
          <strong>Am I building load safely?</strong> Injuries usually come from ramping up faster
          than the body can adapt, and that ramp is measurable before it hurts you.
        </p>
        <p>
          The data comes from your GPS watch, either synced automatically or uploaded as files.
          You don&apos;t need to log anything by hand — just run, then check in here.
        </p>
      </Section>

      <Section title="The pages, in one tour">
        <p>
          <strong>Runs</strong> is the log: every run with date, distance, pace, and duration.
          Click any run to open its detail page — the route on a map, weather at run time, and a{' '}
          <strong>Deep Dive</strong> section with your heart rate, pace, and elevation second by
          second, plus per-mile splits. The Deep Dive is where you check a single run&apos;s
          story: did I keep it easy? How did the hills affect me? Did my heart rate creep up late
          in the run?
        </p>
        <p>
          <strong>Heatmap</strong> layers every GPS track you&apos;ve ever recorded onto one map.
          Brighter lines are routes you run often. Use the date slider to watch your territory
          grow over a season.
        </p>
        <p>
          <strong>Analysis</strong> is the coaching brain of the app — trends across many runs
          rather than one. Every chart is explained below. The date slider at the top drives most
          of the charts; the training-load section at the bottom always uses your full history.
        </p>
        <p>
          <strong>Goals</strong> holds your race goals. For each one, the app predicts your finish
          time from your best recent efforts and shows whether you&apos;re on track. It also keeps
          your personal records for standard distances (1K to marathon), detected automatically
          from your runs.
        </p>
        <p>
          <strong>Settings</strong> covers account details and login history.
        </p>
      </Section>

      <Section title="The Analysis page, chart by chart">
        <p className="text-zinc-500">
          A few terms used throughout: <strong>max HR</strong> is your highest observed heart
          rate. <strong>Zone 2</strong> means roughly 65–78% of max HR — a genuinely easy,
          conversational effort. Runs are classified by their average heart rate.
        </p>

        <div className="space-y-5 mt-4">
          <Chart name="Weekly Volume">
            <p>
              Total distance (or run count, or average run length) per calendar week. The
              foundation: fitness follows volume, and volume should grow gradually — the classic
              guideline is no more than ~10% per week. Look for consistency first, growth second.
            </p>
          </Chart>

          <Chart name="Aerobic Development">
            <p>
              Every run plotted as one dot: distance across, average heart rate up. Dots are
              colored blue (oldest in range) to red (newest). What you want to see: the newer,
              redder dots sitting <em>lower</em> than the older blue ones at the same distance —
              the same work costing your heart less. That downward drift is aerobic fitness being
              built. If newer dots drift upward instead, you&apos;re accumulating fatigue or
              pushing too hard too often.
            </p>
          </Chart>

          <Chart name="Aerobic Efficiency">
            <p>
              One number per run: meters covered per minute, per heartbeat (the &quot;efficiency
              factor&quot;). It distills &quot;how much speed does each heartbeat buy me?&quot;
              into a single trend line. Rising = improving. It&apos;s the same signal as the
              scatter above, but easier to read at a glance. Expect noise run to run — judge the
              slope over weeks, not days.
            </p>
          </Chart>

          <Chart name="Aerobic Pace">
            <p>
              The average pace of your easy (Zone 2) runs only, with the axis flipped so up =
              faster. Because it excludes workouts and races, it isolates your cruising speed at
              low effort — the number that best predicts marathon potential. If your easy pace
              gets faster while staying truly easy, your engine is growing.
            </p>
          </Chart>

          <Chart name="Effort Distribution">
            <p>
              Each week&apos;s running time split into easy / moderate / hard. The dashed line
              marks the 75% easy target: decades of coaching practice (and the training of nearly
              every elite distance runner) says roughly 75–80% of running should be easy. Weeks
              with a thin green band are the warning sign — usually it means easy runs are being
              run too hard, which blunts recovery without adding fitness.
            </p>
          </Chart>

          <Chart name="Performance vs. Weather">
            <p>
              Aerobic efficiency plotted against the &quot;feels like&quot; temperature for each
              run, with darker dots meaning muggier air (higher <strong>dew point</strong> — a
              measure of how much moisture is in the air, which determines how well sweat can
              cool you). Heat and humidity genuinely slow everyone down; this chart shows{' '}
              <em>your</em> personal cost. Use it to recalibrate expectations in summer — a
              &quot;slow&quot; August run may be a strong performance once you account for the
              conditions.
            </p>
          </Chart>

          <Chart name="Fitness & Fatigue">
            <p>
              Every run earns a training-stress score called <strong>TRIMP</strong> (training
              impulse): minutes × how close your heart rate was to max, weighted so hard efforts
              count disproportionately more. From daily TRIMP the app tracks three curves:{' '}
              <strong>Fitness (CTL)</strong>, your 42-day average load — it builds slowly and
              decays slowly; <strong>Fatigue (ATL)</strong>, your 7-day average — it spikes fast
              and fades fast; and <strong>Form (TSB)</strong> = fitness − fatigue. Negative form
              is normal (and necessary) during building; positive form means you&apos;re fresh.
              For a race, you want fitness high and form positive — that&apos;s what a taper is
              for.
            </p>
          </Chart>

          <Chart name="Acute : Chronic Load">
            <p>
              One number: this week&apos;s load divided by your 6-week base (fatigue ÷ fitness).
              It answers &quot;am I ramping up faster than my body can absorb?&quot; 0.8–1.3 is
              the sweet spot — building sustainably. Above 1.3, ease off soon. Above 1.5,
              you&apos;re in the zone most associated with injury in the sports-science
              literature — take rest seriously. Below 0.8 you&apos;re recovering or tapering,
              which is fine when it&apos;s on purpose.
            </p>
          </Chart>

          <Chart name="Long Run Progression">
            <p>
              The longest single run of each week over the last 16 weeks — the length of a typical
              marathon build. The long run is the cornerstone workout of distance training; this
              chart makes its trajectory honest. You want stair-step growth with occasional
              cut-back weeks, not a flat line and not a sudden spike.
            </p>
          </Chart>
        </div>
      </Section>

      <Section title="A simple weekly routine">
        <p>
          <strong>After each run</strong>, glance at the run&apos;s Deep Dive: was the effort what
          you intended? <strong>Once a week</strong>, open Analysis: check Effort Distribution
          (enough easy?), the Acute:Chronic number (ramping safely?), and Weekly Volume
          (consistent?). <strong>Once a month</strong>, zoom the date range out and look at
          Aerobic Efficiency and Aerobic Pace: is the engine growing? If yes — keep going.
          Patience is the whole game.
        </p>
      </Section>
    </div>
  )
}

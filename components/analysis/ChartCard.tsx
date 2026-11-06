import Link from 'next/link'

/** Small "?" that opens this chart's explanation in the guide. */
export function HelpLink({ id, label }: { id: string; label: string }) {
  return (
    <Link
      href={`/guide#${id}`}
      aria-label={`How to read ${label}`}
      title={`How to read ${label}`}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[10px] font-medium leading-none text-zinc-400 hover:border-zinc-900 hover:text-zinc-900 transition-colors"
    >
      ?
    </Link>
  )
}

export default function ChartCard({
  title,
  subtitle,
  help,
  children,
}: {
  title: string
  subtitle: string
  /** Guide anchor id; shows a "?" link next to the title. */
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5">
      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
        {title}
        {help && <HelpLink id={help} label={title} />}
      </h2>
      <p className="text-xs text-zinc-500 mt-0.5 mb-4">{subtitle}</p>
      {children}
    </div>
  )
}

export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="h-64 flex items-center justify-center text-sm text-zinc-400 text-center px-6">
      {message}
    </div>
  )
}

export default function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
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

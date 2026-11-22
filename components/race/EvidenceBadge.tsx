import { EVIDENCE_HELP, EVIDENCE_LABEL, type Evidence } from '@/lib/racePrinciples'

const STYLE: Record<Evidence, string> = {
  research: 'bg-emerald-50 text-emerald-800',
  debated: 'bg-amber-50 text-amber-800',
  consensus: 'bg-blue-50 text-blue-800',
  app: 'bg-zinc-100 text-zinc-700',
}

export default function EvidenceBadge({ evidence }: { evidence: Evidence }) {
  return (
    <span
      title={EVIDENCE_HELP[evidence]}
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STYLE[evidence]}`}
    >
      {EVIDENCE_LABEL[evidence]}
    </span>
  )
}

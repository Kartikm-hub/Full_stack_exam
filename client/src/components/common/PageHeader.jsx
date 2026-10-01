/**
 * Reusable page frame: title block, description, optional actions, then content.
 * Keeping this in one place is what makes the ten pages consistent without
 * copying markup.
 */
export function PageHeader({ title, description, actions, className }) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-brand-950 sm:text-2xl">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

/** Small labelled metric used on the dashboard. */
export function StatTile({ label, value, hint, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-brand-950',
    focus: 'text-focus-700',
    info: 'text-calm-700',
    muted: 'text-ink-400',
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-ink-400 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-400">{hint}</p> : null}
    </div>
  )
}

/** Section heading for grouped panels. */
export function SectionHeading({ title, description, action }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-ink-800">{title}</h2>
        {description ? <p className="text-xs text-ink-400">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

/** Marker for scaffolding-only sections that are not wired to data yet. */
export function PlaceholderNote({ children = 'Placeholder — no data connected in this prompt.' }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-ink-400">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-ink-300" />
      {children}
    </p>
  )
}

export default PageHeader
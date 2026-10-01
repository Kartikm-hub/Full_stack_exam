import { ConstructionIcon } from 'lucide-react'

import { PlaceholderNote } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Generic placeholder page for a route whose data contract is still an
 * implementation prompt. Centralised so all ten routes look and behave
 * identically.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {string[]} [props.upcoming]  planned capabilities, shown as read-only chips
 * @param {string} [props.owner]       team member who picks this up next
 */
export function PlaceholderPage({ title, description, upcoming = [], owner, tone = 'brand' }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-brand-950">{title}</h1>
          <Badge tone="neutral">Placeholder</Badge>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ConstructionIcon aria-hidden="true" className="size-4 text-ink-400" />
            Not wired up yet
          </CardTitle>
          <CardDescription>
            This route exists so the navigation and layout can be built and reviewed first. No
            data is fetched and no agent command is sent from here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {upcoming.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-ink-400 uppercase">Planned</p>
              <ul className="flex flex-wrap gap-2">
                {upcoming.map((item) => (
                  <li key={item}>
                    <Badge tone={tone}>{item}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {owner ? <p className="text-sm text-ink-500">Owner: {owner}</p> : null}

          <PlaceholderNote />
        </CardContent>
      </Card>

      {/* Skeletons hint at the final layout without faking data. */}
      <div className={cn('grid gap-4 sm:grid-cols-3')} aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <Card key={index} inset className="h-28" />
        ))}
      </div>
    </div>
  )
}

export default PlaceholderPage
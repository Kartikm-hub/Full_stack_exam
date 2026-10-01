import { Outlet } from 'react-router-dom'

import { AgentUnreachableNotice } from '@/components/agent/AgentStatusBadge'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAgentStatus } from '@/features/agent/useAgentStatus'
import { cn } from '@/lib/utils'

/**
 * Responsive application shell: sidebar + header + main content area.
 *
 * Breakpoints (requirement: mobile, tablet, desktop):
 *   mobile  (< 640px)   header with drawer nav, single-column content
 *   tablet  (640–1024px) same drawer, wider gutters and padding
 *   desktop (>= 1024px) fixed 260px sidebar, inline agent status, 3-col grids
 *
 * Agent status is read from context, so a page never imports transport code.
 */
export function AppLayout({ children }) {
  const agentStatus = useAgentStatus()
  const showNotice = agentStatus.status === 'UNAVAILABLE'

  return (
    <div className="min-h-full">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] border-r border-ink-200 lg:block">
        <Sidebar agentStatus={agentStatus} />
      </aside>

      <div className="lg:pl-[260px]">
        <Header agentStatus={agentStatus} />

        <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {showNotice ? <AgentUnreachableNotice className="mb-6" /> : null}
          {children ?? <Outlet />}
        </main>

        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
          <p className="text-xs leading-relaxed text-ink-400">
            Focus Mode — distraction lockdown, reversible by design. The browser never touches
            your operating system; the local agent is the only component that does.
          </p>
        </footer>
      </div>
    </div>
  )
}

/**
 * Sidebar-less variant for a single-screen page such as an active focus
 * session: fewer distractions and the End action is the only call to action.
 */
export function FocusLayout({ children }) {
  const agentStatus = useAgentStatus()

  return (
    <div className="flex min-h-full flex-col">
      <Header agentStatus={agentStatus} />

      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-3xl">{children ?? <Outlet />}</div>
      </main>

      <footer className="px-4 pb-6 sm:px-6">
        <p className="text-center text-xs text-ink-400">
          You can end this session at any time from this page or from the agent tray icon.
        </p>
      </footer>
    </div>
  )
}

/** Shared page frame: consistent gutters, width and vertical rhythm. */
export function PageContainer({ className, children }) {
  return <div className={cn('mx-auto w-full max-w-4xl', className)}>{children}</div>
}
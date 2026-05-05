import { NavLink } from 'react-router-dom'
import { Activity, Apple, LineChart, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/food', label: 'Food', icon: Apple },
  { to: '/trends', label: 'Trends', icon: LineChart },
] as const

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'group flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform',
                    isActive ? 'scale-105' : 'opacity-80 group-hover:opacity-100',
                  )}
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

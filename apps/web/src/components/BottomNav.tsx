import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Today' },
  { to: '/activity', label: 'Activity' },
  { to: '/food', label: 'Food' },
]

export function BottomNav() {
  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '10px 0 max(env(safe-area-inset-bottom), 10px)',
        zIndex: 10,
      }}
    >
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          style={({ isActive }) => ({
            color: isActive ? 'var(--accent)' : 'var(--muted)',
            fontSize: 12,
            textDecoration: 'none',
            padding: '4px 12px',
          })}
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}

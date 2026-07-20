import { CalendarDays, Home, MapPin, UserRound } from 'lucide-react'

const navigationItems = [
  { label: 'Inicio', href: '/', icon: Home },
  { label: 'Horarios', href: '/horarios', icon: CalendarDays },
  { label: 'Complejo', href: '/complejo', icon: MapPin },
]

export function BottomNavigation({ session }) {
  const currentPath = window.location.pathname
  const items = [...navigationItems, { label: 'Mi perfil', href: session ? '/perfil' : '/acceso', icon: UserRound }]

  return <nav className="bottom-navigation" aria-label="Navegación rápida">
    <div>{items.map(({ label, href, icon: Icon }) => {
      const isActive =
        (currentPath === '/' && label === 'Inicio') ||
        (currentPath === '/horarios' && label === 'Horarios') ||
        (currentPath === '/complejo' && label === 'Complejo') ||
        ((currentPath === '/perfil' || currentPath === '/acceso') && label === 'Mi perfil')

      return <a key={label} className={isActive ? 'is-active' : ''} href={href} aria-current={isActive ? 'page' : undefined} aria-label={label}>
        <Icon size={20} /><span>{label}</span>
      </a>
    })}</div>
  </nav>
}

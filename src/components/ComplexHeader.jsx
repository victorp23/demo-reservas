import { CalendarDays, Home, MapPin, Trophy, UserRound } from 'lucide-react'

export function ComplexHeader({ complex, session }) {
  const currentPath = window.location.pathname
  const isProfileRoute = currentPath === '/perfil' || currentPath === '/acceso'
  const navigationItems = [
    { label: 'Inicio', href: '/', icon: Home, active: currentPath === '/' },
    { label: 'Horarios', href: '/horarios', icon: CalendarDays, active: currentPath === '/horarios' },
    { label: 'Torneos', href: '/torneos', icon: Trophy, active: currentPath === '/torneos' },
    { label: 'Complejo', href: '/complejo', icon: MapPin, active: currentPath === '/complejo' },
    { label: 'Mi perfil', href: session ? '/perfil' : '/acceso', icon: UserRound, active: isProfileRoute },
  ]

  return <header className="complex-header">
    <a className="brand" href="/" aria-label={`${complex?.name || 'Complejo deportivo'} inicio`}>
      {complex?.logo && <span className="brand-mark"><img src={complex.logo} alt="" /></span>}
      <span>{complex?.name || 'Complejo deportivo'}</span>
    </a>
    <nav className="complex-nav" aria-label="Navegación principal">
      {navigationItems.map(({ label, href, icon: Icon, active }) => (
        <a key={label} href={href} className={active ? 'is-active' : undefined} aria-current={active ? 'page' : undefined}>
          <Icon size={15} /> {label}
        </a>
      ))}
    </nav>
  </header>
}

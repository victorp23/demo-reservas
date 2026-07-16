import { CalendarDays, Home, MapPin } from 'lucide-react'

const navigationItems = [
  { label: 'Inicio', href: '#inicio', icon: Home },
  { label: 'Canchas', href: '#canchas', icon: CalendarDays },
  { label: 'Ubicación', href: '#ubicacion', icon: MapPin },
]

export function BottomNavigation({ isSecondaryPage = false }) {
  const basePath = isSecondaryPage ? '/' : ''
  return <nav className="bottom-navigation" aria-label="Navegación rápida">
    <div>{navigationItems.map(({ label, href, icon: Icon }, index) => <a key={href} className={index === 0 ? 'is-active' : ''} href={`${basePath}${href}`} aria-label={label}><Icon size={21} /><span>{label}</span></a>)}</div>
  </nav>
}

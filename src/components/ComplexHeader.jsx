import { CalendarDays, Home, MapPin } from 'lucide-react'

export function ComplexHeader({ complex, isSecondaryPage = false }) {
  const basePath = isSecondaryPage ? '/' : ''
  return <header className="complex-header">
    <a className="brand" href={`${basePath}#inicio`} aria-label={`${complex?.name || 'Complejo deportivo'} inicio`}>
      {complex?.logo && <span className="brand-mark"><img src={complex.logo} alt="" /></span>}
      <span>{complex?.name || 'Complejo deportivo'}</span>
    </a>
    <nav className="complex-nav" aria-label="Navegación principal">
      <a href={`${basePath}#inicio`}><Home size={15} /> Inicio</a>
      <a href={`${basePath}#canchas`}><CalendarDays size={15} /> Canchas</a>
      <a href={`${basePath}#ubicacion`}><MapPin size={15} /> Ubicación</a>
    </nav>
  </header>
}

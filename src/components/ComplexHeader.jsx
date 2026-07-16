import { Menu, X } from 'lucide-react'
import { useState } from 'react'

export function ComplexHeader({ complex }) {
  const [isOpen, setIsOpen] = useState(false)

  return <header className="complex-header">
    <a className="brand" href="#inicio" aria-label={`${complex?.name || 'Complejo deportivo'} inicio`}>
      {complex?.logo && <span className="brand-mark"><img src={complex.logo} alt="" /></span>}
      <span>{complex?.name || 'Complejo deportivo'}</span>
    </a>
    <nav className={isOpen ? 'complex-nav is-open' : 'complex-nav'}>
      <a href="#inicio" onClick={() => setIsOpen(false)}>Inicio</a>
      <a href="#canchas" onClick={() => setIsOpen(false)}>Canchas</a>
      <a href="#ubicacion" onClick={() => setIsOpen(false)}>Ubicación</a>
    </nav>
    <button className="mobile-menu-button" onClick={() => setIsOpen((open) => !open)} aria-label="Abrir menú" aria-expanded={isOpen}>{isOpen ? <X size={22} /> : <Menu size={22} />}</button>
  </header>
}

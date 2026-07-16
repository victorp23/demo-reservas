import { MapPin, MessageCircle, Phone, Sparkles } from 'lucide-react'

export function ComplexInformation({ complex }) {
  return <section id="inicio" className="complex-information">
    <div className="complex-copy">
      <p className="eyebrow"><Sparkles size={13} /> Billares, deporte y buena compañía</p>
      <h1>Tu lugar para<br /><em>compartir y competir.</em></h1>
      <p className="complex-name">{complex.name}</p>
      <p className="complex-description">{complex.description || 'Bienvenido. Consulta la disponibilidad de nuestras canchas y reserva tu próximo partido.'}</p>
      <div className="complex-details">
        {complex.address && <p><MapPin size={18} /><span><small>DIRECCIÓN</small>{complex.address}</span></p>}
        {complex.phone && <p><Phone size={18} /><span><small>TELÉFONO</small>{complex.phone}</span></p>}
        {complex.whatsapp && <p><MessageCircle size={18} /><span><small>WHATSAPP</small>{complex.whatsapp}</span></p>}
      </div>
      <a className="hero-button" href="#canchas">Explorar canchas <span>↓</span></a>
    </div>
    <div className="hero-showcase">
      <div className="showcase-ring" />
      <img className="showcase-logo" src={complex.logo} alt={`Logo de ${complex.name}`} />
    </div>
  </section>
}

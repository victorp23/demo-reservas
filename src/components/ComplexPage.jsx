import { CalendarDays, ExternalLink, MapPin, MessageCircle, Phone } from 'lucide-react'

function formatType(type) { return String(type || 'CANCHA').replaceAll('_', ' ') }

export function ComplexPage({ complex, courts }) {
  return <main className="complex-page">
    <section className="complex-page-hero">
      <div className="complex-page-copy">
        <p className="eyebrow">CONOCE EL COMPLEJO</p>
        <h1>COMPLEJO</h1>
        <strong className="complex-page-name">{complex.name}</strong>
        <p>{complex.description || 'Conoce nuestra ubicación, servicios y canchas disponibles.'}</p>
        {complex.mapsUrl && <a href={complex.mapsUrl} target="_blank" rel="noreferrer">Cómo llegar <ExternalLink size={15} /></a>}
      </div>
    </section>

    <section className="complex-page-content">
      <div className="complex-page-heading"><p className="eyebrow dark">INFORMACIÓN DEL COMPLEJO</p><h2>Todo en un solo lugar</h2></div>
      <div className="complex-information-grid">
        {complex.address && <article><MapPin size={21} /><small>DIRECCIÓN</small><strong>{complex.address}</strong></article>}
        {complex.phone && <article><Phone size={21} /><small>TELÉFONO</small><strong>{complex.phone}</strong></article>}
        {complex.whatsapp && <article><MessageCircle size={21} /><small>WHATSAPP</small><strong>{complex.whatsapp}</strong></article>}
        <article><CalendarDays size={21} /><small>CANCHAS ACTIVAS</small><strong>{courts.length} disponible{courts.length === 1 ? '' : 's'}</strong></article>
      </div>

      <div className="complex-page-heading complex-courts-heading"><p className="eyebrow dark">ESPACIOS DISPONIBLES</p><h2>Nuestras canchas</h2></div>
      <div className="complex-page-courts">{courts.map((court) => <article key={court.id}><span>{formatType(court.type)}</span><h3>{court.name}</h3><p>Turnos de {court.duration || 60} minutos</p><a href={`/horarios?cancha=${court.id}`}>Ver horarios</a></article>)}</div>

      {complex.mapsEmbedUrl && <div className="complex-page-map"><iframe title={`Mapa de ${complex.name}`} src={complex.mapsEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /></div>}
    </section>
  </main>
}

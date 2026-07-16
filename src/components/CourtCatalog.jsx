import { Clock3, UsersRound } from 'lucide-react'

function formatType(type) {
  return String(type || 'CANCHA').replaceAll('_', ' ')
}

export function CourtCatalog({ courts }) {
  return <section className="court-catalog" id="canchas">
    <div className="section-heading"><p className="eyebrow dark"><span /> CANCHAS DISPONIBLES</p><h2>Conoce nuestras canchas</h2><p>Selecciona una cancha para consultar sus horarios y disponibilidad.</p></div>
    <div className="court-grid">
      {courts.map((court) => <article className="court-card" key={court.id}>
        {court.imageUrl ? <img className="court-image" src={court.imageUrl} alt={`Cancha ${court.name}`} loading="lazy" /> : <div className={`court-image-placeholder ${court.tone}`}><span>⚽</span></div>}
        <div className="court-card-content"><p className="court-type">{formatType(court.type)}</p><h3>{court.name}</h3><div className="court-meta"><span><Clock3 size={15} /> Reservas de {court.duration || 60} min</span>{court.capacity && <span><UsersRound size={15} /> {court.capacity} jugadores</span>}</div>{court.price && <p className="court-price">{court.price}</p>}<button disabled>Próximamente: consultar horarios</button></div>
      </article>)}
    </div>
  </section>
}

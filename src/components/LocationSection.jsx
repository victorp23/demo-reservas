import { ExternalLink, MapPin } from 'lucide-react'

export function LocationSection({ complex }) {
  if (!complex.address && !complex.mapsUrl && !complex.mapsEmbedUrl) return null

  return <section className="location-section" id="ubicacion">
    <div className="location-heading"><p className="eyebrow">CÓMO LLEGAR</p><h2>Visítanos en<br />{complex.location || 'Quito'}</h2><p>{complex.address || 'Consulta nuestra ubicación en Google Maps.'}</p>{complex.mapsUrl && <a href={complex.mapsUrl} target="_blank" rel="noreferrer">Abrir en Google Maps <ExternalLink size={15} /></a>}</div>
    {complex.mapsEmbedUrl && <div className="location-map"><iframe title={`Ubicación de ${complex.name}`} src={complex.mapsEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /><span><MapPin size={15} /> {complex.name}</span></div>}
  </section>
}

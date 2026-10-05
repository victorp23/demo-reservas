import { ExternalLink, MapPin, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { inviteDemo } from '../data/inviteDemo'
import './invite-poster-event.css'

function EventModal({ title, children, close }) {
  return (
    <div className="invitation-modal-backdrop" onClick={close} role="presentation">
      <section className="invitation-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button className="invitation-modal-close" type="button" onClick={close} aria-label="Cerrar"><X size={18} /></button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  )
}

function getTimeLeft(dateString) {
  const difference = Math.max(0, new Date(dateString).getTime() - Date.now())
  return {
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference / 3600000) % 24),
    minutes: Math.floor((difference / 60000) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    finished: difference === 0,
  }
}

export function InvitationPage({ invite = inviteDemo }) {
  const { event, media = [] } = invite
  const audioRef = useRef(null)
  const [modal, setModal] = useState(null)
  const [audioPrompt, setAudioPrompt] = useState(true)
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(event.starts_at))
  const birthdayPeople = [
    { name: 'Ale Jochis', date: '04 de octubre', image: '/ale-jochis.png' },
    { name: 'Nico Sed', date: '15 de octubre', image: '/nico-sed-v2.png', imageClass: 'birthday-photo-nico' },
    { name: 'Lesly', date: '22 de octubre', image: '/lesly.png', imageClass: 'birthday-photo-lesly' },
    { name: 'Elbirita', date: '23 de octubre', image: '/elbirita.png', imageClass: 'birthday-photo-elbirita' },
  ]
  const video = media.find((item) => item.kind === 'VIDEO')
  const audio = media.find((item) => item.kind === 'AUDIO')
  const images = media.filter((item) => item.kind === 'IMAGE')

  useEffect(() => {
    const timer = window.setInterval(() => setTimeLeft(getTimeLeft(event.starts_at)), 1000)
    return () => window.clearInterval(timer)
  }, [event.starts_at])

  function startMusic() {
    if (!audioPrompt) audioRef.current?.play().catch(() => {})
  }

  function allowMusic() {
    audioRef.current?.play().catch(() => {})
    setAudioPrompt(false)
  }

  return (
    <main className="invitation-page" onPointerDown={startMusic}>
      <audio ref={audioRef} src="/fondo.mp3" autoPlay loop preload="auto" aria-label="Música de fondo" />
      <section className="invitation-card" aria-label="Invitación a la cangrejada">
        <div className="invitation-sky" />
        <div className="invitation-title" aria-label="La gran cangrejada de Auxilio Mecánico FC">
          <img className="invitation-sign" src="/cangrejada-final.png" alt="Cangrejada cumpleañera arrechísima bailable, octubre 2026" />
        </div>
        <div className="invitation-countdown" aria-label="Cuenta regresiva para el evento">
          <p>⏳ FALTAN</p>
          {timeLeft.finished ? <strong className="invitation-countdown-finished">¡ES HOY!</strong> : <div className="invitation-countdown-units">{[['days', 'DÍAS'], ['hours', 'HRS'], ['minutes', 'MIN'], ['seconds', 'SEG']].map(([key, label]) => <span key={key}><b>{String(timeLeft[key]).padStart(2, '0')}</b><small>{label}</small></span>)}</div>}
          <time dateTime={event.starts_at}>📅 Sábado 10 de octubre de 2026 · 10:00 a. m.</time>
        </div>
        <div className="invitation-scene">
          <img className="invitation-cars" src="/carros.png" alt="Personas disfrutando en carros chocones" />
          <img className="invitation-pot" src="/olla.png" alt="Olla de cangrejos" />
        </div>
        <div className="invitation-actions">
          <button type="button" onClick={() => setModal('map')}><MapPin size={16} /> Ubicación</button>
          <button type="button" onClick={() => setModal('birthdays')}>🎂 Cumpleañeros</button>
          <button type="button" onClick={() => setModal('more')}>🎉 Ver más</button>
        </div>
      </section>

      {audioPrompt && <div className="audio-permission-backdrop"><section className="audio-permission" role="dialog" aria-modal="true" aria-labelledby="audio-permission-title"><img className="audio-permission-crab" src="/cangejo.png" alt="Cangrejo invitándote a la fiesta" /><div className="audio-permission-note">♫</div><p className="audio-permission-kicker">¡QUE EMPIECE LA FIESTA!</p><h2 id="audio-permission-title">¿Le ponemos música?</h2><p className="audio-permission-copy">Activa el ambiente de la cangrejada.</p><div className="audio-permission-actions"><button type="button" onClick={allowMusic}>♫ Sí, poner música</button><button type="button" onClick={() => setAudioPrompt(false)}>Ahora no</button></div></section></div>}

      {modal === 'map' && <EventModal title="¿Cómo llegamos?" close={() => setModal(null)}><p className="invitation-place"><MapPin size={18} /> {event.venue_name || 'Billares Bugs Bunny'}</p><p>{event.venue_address || 'La sede del equipo'}</p><iframe title="Mapa del evento" src={`https://www.google.com/maps?q=${encodeURIComponent(`${event.venue_name || ''} ${event.venue_address || ''}`)}&output=embed`} loading="lazy" /><a className="invitation-modal-link" href={event.maps_url} target="_blank" rel="noreferrer">Abrir en Google Maps <ExternalLink size={15} /></a></EventModal>}
      {modal === 'birthdays' && <EventModal title="Los cumpleañeros" close={() => setModal(null)}><div className="birthday-grid">{birthdayPeople.map((person) => <article className="birthday-card" key={person.name}>{person.image ? <img className={`birthday-photo ${person.imageClass || ''}`} src={person.image} alt={`Foto de ${person.name}`} /> : <div className="birthday-photo-slot" aria-label={`Espacio para la foto de ${person.name}`}>📸<span>Tu foto aquí</span></div>}<div className="birthday-copy"><h3>{person.name}</h3><p>{person.date}</p></div></article>)}</div></EventModal>}
      {modal === 'more' && <EventModal title="¡Más sorpresas!" close={() => setModal(null)}><div className="invitation-more"><div className="invitation-more-hero"><img src="/cangejo.png" alt="Cangrejo festivo" /><div><span>FIESTA · COMIDA · CUMPLEAÑOS</span><strong>¡Prepárate para celebrar!</strong></div></div><p className="invitation-more-lead">Este 10 de octubre nos reunimos para celebrar a Jochis, Nico Sed, Lesly y Elvirita como se debe. 🥳🎉</p><h3 className="invitation-more-heading">🍽️ ¿Qué incluye?</h3><ul className="invitation-more-list"><li>🦀 Plato de cangrejos</li><li>🍤 Plato de ceviche</li><li>🥩 Picadas de asado</li><li>🥤 Bebidas</li><li>🏐 Cancha de vóley</li><li>🎱 Billar</li><li>🔥 Área de asado</li><li>🎤 Karaoke</li><li>🐓 Área de gallos</li><li>🎉 Acceso a las áreas comunes del complejo Billas Bugs Bunny</li></ul><div className="invitation-more-meta"><p>📍 <strong>Sede Auxilio Mecánico FC</strong></p><p>📅 <strong>10 de octubre</strong></p></div><p className="invitation-more-closing">Así que pilas mi gente, vayan separando la cuota porque se viene un día de comida, cumpleaños, joda y full ambiente. 😎🔥🍻</p><p className="invitation-more-signoff">🖤💛 ¡Auxilio Mecánico FC, presentes dentro y fuera de la cancha! 🖤💛</p></div>{video && <video className="invitation-media" src={video.public_url} controls />}{audio && <audio className="invitation-media" src={audio.public_url} controls />}{images.length > 1 && <div className="invitation-gallery">{images.slice(1).map((image) => <img className="invitation-gallery-image" key={image.id} src={image.public_url} alt={image.alt_text || image.title} />)}</div>}</EventModal>}
    </main>
  )
}

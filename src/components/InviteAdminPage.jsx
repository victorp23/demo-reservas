import { CalendarDays, Check, Clipboard, ExternalLink, ImagePlus, Link2, LogOut, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { getStoredInvites, saveInvite, slugify } from '../lib/inviteStore'
import './InviteAdminPage.css'
import './am-admin.css'
import './am-admin-shell.css'
import './invite-admin-actions.css'

const initialForm = { title: '', subtitle: 'Una invitación especial', hostNames: '', type: 'WEDDING', date: '', time: '18:00', venue: '', address: '', description: '' }

function buildInvite(form, slug = slugify(form.title), media = []) {
  return { event: { slug, event_type: form.type, title: form.title, subtitle: form.subtitle, host_names: form.hostNames, description: form.description, starts_at: `${form.date}T${form.time}:00-05:00`, venue_name: form.venue, venue_address: form.address, maps_url: 'https://maps.google.com', status: 'PUBLISHED' }, sections: [{ section_type: 'STORY', title: 'Nuestra historia', content: { text: form.description || 'Un momento especial que queremos compartir contigo.' } }, { section_type: 'SCHEDULE', title: 'El gran día', content: { items: [{ time: form.time, label: 'Celebración' }] } }], media }
}

function formFromInvite(invite) {
  const event = invite.event
  return { title: event.title || '', subtitle: event.subtitle || '', hostNames: event.host_names || '', type: event.event_type || 'OTHER', date: event.starts_at?.slice(0, 10) || '', time: event.starts_at?.slice(11, 16) || '18:00', venue: event.venue_name || '', address: event.venue_address || '', description: event.description || '' }
}

function MediaPicker({ media, setMedia }) {
  const [error, setError] = useState('')
  async function addFiles(event) {
    const files = [...event.target.files]
    setError('')
    const valid = files.filter((file) => file.size <= 12 * 1024 * 1024)
    if (valid.length !== files.length) setError('Cada archivo debe pesar máximo 12 MB.')
    const loaded = await Promise.all(valid.map((file) => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ id: crypto.randomUUID(), kind: file.type.startsWith('video/') ? 'VIDEO' : file.type.startsWith('audio/') ? 'AUDIO' : 'IMAGE', public_url: reader.result, mime_type: file.type, title: file.name, alt_text: file.name })
      reader.readAsDataURL(file)
    })))
    setMedia((current) => [...current, ...loaded])
    event.target.value = ''
  }
  return <div className="am-media-manager"><div className="am-upload-box"><ImagePlus size={24} /><div><strong>Contenido visual</strong><span>Imágenes, videos y audio. Máximo 12 MB por archivo.</span></div><label className="am-file-button"><Plus size={16} /> Agregar<input type="file" accept="image/*,video/*,audio/*" multiple onChange={addFiles} /></label></div>{error && <p className="am-media-error">{error}</p>}{media.length > 0 && <div className="am-media-preview">{media.map((item) => <article key={item.id}>{item.kind === 'VIDEO' ? <video src={item.public_url} muted /> : item.kind === 'AUDIO' ? <audio src={item.public_url} controls /> : <img src={item.public_url} alt={item.alt_text || item.title} />}<button type="button" onClick={() => setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id))} aria-label={`Eliminar ${item.title}`}><X size={13} /></button><span>{item.kind}</span></article>)}</div>}</div>
}

export function InviteAdminPage() {
  const [form, setForm] = useState(initialForm)
  const [media, setMedia] = useState([])
  const [invites, setInvites] = useState(getStoredInvites)
  const [createdLink, setCreatedLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [editingSlug, setEditingSlug] = useState('')
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  function editInvite(invite) { setEditingSlug(invite.event.slug); setForm(formFromInvite(invite)); setMedia(invite.media || []); document.getElementById('new-event')?.scrollIntoView({ behavior: 'smooth' }) }
  function saveEvent(event) { event.preventDefault(); const invite = buildInvite(form, editingSlug || slugify(form.title), media); saveInvite(invite); setInvites(getStoredInvites()); setCreatedLink(`${window.location.origin}/invitacion?slug=${invite.event.slug}`); setForm(initialForm); setMedia([]); setEditingSlug('') }
  function cancelEdit() { setForm(initialForm); setMedia([]); setEditingSlug('') }
  async function copyLink(link) { await navigator.clipboard?.writeText(link); setCopied(link); setTimeout(() => setCopied(false), 1800) }

  return <main className="am-admin-page"><div className="am-admin-background" /><header className="am-admin-nav"><a href="/" className="am-admin-brand"><img src="/logo2.png" alt="Auxilio Mecánico" /><span>AUXILIO MECÁNICO<strong>INVITACIONES</strong></span></a><div className="am-admin-nav-actions"><a href="/" title="Ver landing pública"><ExternalLink size={17} /></a><a href="/" className="am-admin-logout"><LogOut size={16} /> Salir</a></div></header><div className="am-admin-main"><div className="am-admin-heading"><div><p className="am-admin-kicker">ESPACIO DE TRABAJO</p><h1>Panel Administrador</h1><p>Gestiona tus eventos e invitaciones digitales.</p></div><button className="am-admin-primary" onClick={() => document.getElementById('new-event')?.scrollIntoView({ behavior: 'smooth' })}><Plus size={17} /> Nueva invitación</button></div><section className="am-admin-stats"><article><CalendarDays size={22} /><div><strong>{invites.length}</strong><span>Eventos creados</span></div></article><article><Link2 size={22} /><div><strong>{invites.length}</strong><span>Enlaces activos</span></div></article><article><Sparkles size={22} /><div><strong>0</strong><span>Confirmaciones</span></div></article></section><div className="am-admin-grid"><section className="am-admin-card" id="new-event"><div className="am-card-heading"><div><p className="am-admin-kicker">{editingSlug ? 'EDITAR EVENTO' : 'NUEVO EVENTO'}</p><h2>{editingSlug ? 'Edita tu invitación' : 'Crea una invitación'}</h2><p>Configura los datos que aparecerán en la landing pública.</p></div><span className="am-card-number">01</span></div><form className="am-invite-form" onSubmit={saveEvent}><div className="am-fields"><label>Tipo de evento<select value={form.type} onChange={(event) => update('type', event.target.value)}><option value="WEDDING">Boda</option><option value="BIRTHDAY">Cumpleaños</option><option value="BAPTISM">Bautizo</option><option value="GRADUATION">Graduación</option><option value="OTHER">Otro evento</option></select></label><label>Nombre del evento<input required value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Sofía & Mateo" /></label><label>Subtítulo<input value={form.subtitle} onChange={(event) => update('subtitle', event.target.value)} placeholder="Nos casamos" /></label><label>Anfitriones<input value={form.hostNames} onChange={(event) => update('hostNames', event.target.value)} placeholder="Sofía y Mateo" /></label><label>Fecha<input required type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></label><label>Hora<input required type="time" value={form.time} onChange={(event) => update('time', event.target.value)} /></label><label>Nombre del lugar<input value={form.venue} onChange={(event) => update('venue', event.target.value)} placeholder="Billas de Bugs Buny" /></label><label>Dirección<input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Guayaquil, Ecuador" /></label></div><label className="am-full-field">Mensaje de bienvenida<textarea rows="3" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Escribe unas palabras para tus invitados..." /></label><MediaPicker media={media} setMedia={setMedia} /><div className="am-form-actions"><button className="am-admin-submit" type="submit"><Sparkles size={17} /> {editingSlug ? 'Guardar cambios' : 'Crear invitación'}</button>{editingSlug && <button className="am-admin-cancel" type="button" onClick={cancelEdit}><X size={16} /> Cancelar</button>}</div></form></section><aside className="am-admin-card am-events-card"><div className="am-card-heading"><div><p className="am-admin-kicker">MIS EVENTOS</p><h2>Invitaciones creadas</h2></div><span className="am-event-count">{invites.length}</span></div>{createdLink && <div className="am-created-link"><span>ÚLTIMO ENLACE GENERADO</span><strong>{createdLink}</strong><button type="button" onClick={() => copyLink(createdLink)}>{copied === createdLink ? <><Check size={15} /> Copiado</> : <><Clipboard size={15} /> Copiar enlace</>}</button></div>}{invites.length ? <div className="am-event-list">{invites.map((invite) => { const link = `${window.location.origin}/invitacion?slug=${invite.event.slug}`; return <article key={invite.event.slug}><div className="am-event-dot"><Sparkles size={15} /></div><div className="am-event-info"><strong>{invite.event.title}</strong><span>{invite.event.venue_name || 'Lugar pendiente'} · {invite.event.starts_at.slice(0, 10)} · {invite.media?.length || 0} medios</span></div><div className="am-event-actions"><button type="button" onClick={() => editInvite(invite)} title="Editar invitación"><Pencil size={16} /></button><a href={`/invitacion?slug=${invite.event.slug}`} target="_blank" rel="noreferrer" title="Ver invitación"><ExternalLink size={16} /></a><button type="button" onClick={() => copyLink(link)} title="Copiar enlace">{copied === link ? <Check size={16} /> : <Clipboard size={16} />}</button><button type="button" disabled title="Disponible con Supabase"><Trash2 size={16} /></button></div></article> })}</div> : <div className="am-empty-state"><Sparkles size={25} /><p>Aún no tienes eventos creados.</p><span>Completa el formulario para generar tu primer enlace.</span></div>}</aside></div></div><footer className="am-admin-footer"><span>© 2026 Auxilio Mecánico F.C.</span><span>Invitaciones digitales</span></footer><nav className="am-mobile-nav"><a href="/" title="Inicio"><ExternalLink size={19} /></a><a href="#new-event" className="active" title="Nueva invitación"><Plus size={21} /></a><a href="#eventos" title="Mis eventos"><CalendarDays size={19} /></a></nav></main>
}

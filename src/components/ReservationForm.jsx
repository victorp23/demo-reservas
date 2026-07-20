import { CheckCircle2, LoaderCircle, X } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

function formatDate(day) {
  return `${day.dayName}, ${day.dayNumber} de ${day.month}`
}

export function ReservationForm({ complex, court, day, slot, onClose, onCreated }) {
  const [form, setForm] = useState({ equipo: '', notas: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (!supabase || !complex?.id) { setError('La conexión para solicitudes aún no está configurada.'); return }
    setIsSubmitting(true)
    setError('')
    const response = await supabase.rpc('demo_crear_reserva', {
      p_complejo_id: complex.id,
      p_cancha_id: court.id,
      p_fecha: day.isoDate,
      p_hora_inicio: slot,
      p_nombre_equipo: form.equipo || null,
      p_notas: form.notas || null,
    })
    setIsSubmitting(false)
    if (response.error) {
      const message = response.error.code === '23P01' ? 'Ese horario acaba de ser solicitado por otra persona. Elige uno diferente.' : response.error.message || 'No se pudo registrar la solicitud. Inténtalo nuevamente.'
      setError(message)
      return
    }
    setResult(response.data?.[0])
    onCreated?.()
  }

  return <aside className="reservation-form" aria-live="polite">
    <button className="reservation-close" type="button" onClick={onClose} aria-label="Cerrar solicitud"><X size={18} /></button>
    {result ? <div className="reservation-success"><CheckCircle2 size={34} /><p className="eyebrow dark">SOLICITUD RECIBIDA</p><h3>Tu turno está pendiente de confirmación.</h3><p>Guardamos tu solicitud para <strong>{court.name}</strong>, el {formatDate(day)} a las <strong>{slot}</strong>.</p><span>Código: {result.codigo}</span><a href="/perfil">Ver mi perfil</a></div> : <><p className="eyebrow dark">SOLICITAR RESERVA</p><h3>Confirma tu solicitud</h3><p className="reservation-summary">{court.name} · {formatDate(day)} · <strong>{slot}</strong><br />Usaremos los datos guardados en tu perfil.</p><form onSubmit={submit}><label>Nombre del equipo <small>Opcional</small><input value={form.equipo} onChange={(event) => setForm({ ...form, equipo: event.target.value })} placeholder="Ej. Los Tigres" /></label><label>Comentario <small>Opcional</small><textarea value={form.notas} onChange={(event) => setForm({ ...form, notas: event.target.value })} placeholder="Cuéntanos si necesitas algo adicional" rows="3" /></label>{error && <p className="reservation-error">{error}</p>}<button className="reservation-submit" disabled={isSubmitting} type="submit">{isSubmitting ? <><LoaderCircle className="spin" size={16} /> Enviando…</> : 'Enviar solicitud'}</button></form></>}
  </aside>
}

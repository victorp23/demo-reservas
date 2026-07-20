import { ArrowRight, CircleCheck, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function safeReturnPath(value) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/perfil'
}

export function AccessPage({ session }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const returnPath = safeReturnPath(params.get('volver'))
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => { if (session) window.location.replace(returnPath) }, [session, returnPath])

  async function submit(event) {
    event.preventDefault()
    if (!supabase) { setError('La conexión no está configurada todavía.'); return }
    if (mode === 'register' && password !== passwordConfirmation) { setError('Las contraseñas no coinciden.'); return }
    setIsSubmitting(true)
    setError('')
    setMessage('')
    const response = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { nombre: name, telefono: phone }, emailRedirectTo: `${window.location.origin}${returnPath}` } })
    setIsSubmitting(false)
    if (response.error) { setError(response.error.message); return }
    if (mode === 'register' && !response.data.session) setMessage('Revisa tu correo y confirma tu cuenta para poder iniciar sesión.')
  }

  return <main className="access-page"><section className="access-card">
    <ShieldCheck size={34} />
    <p className="eyebrow dark">CUENTA DEL COMPLEJO</p>
    <h1>{mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}</h1>
    <p>{mode === 'login' ? 'Ingresa para gestionar tus reservas y revisar su estado.' : 'Tu cuenta te permitirá guardar solicitudes y revisar tu historial.'}</p>
    <form onSubmit={submit}>
      {mode === 'register' && <><label>Nombre completo<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" /></label><label>Teléfono / WhatsApp<input required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="099 000 0000" /></label></>}
      <label>Correo electrónico<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.com" /></label>
      <label>Contraseña<input required minLength="6" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" /></label>
      {mode === 'register' && <label>Repite tu contraseña<input required minLength="6" type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Repite tu contraseña" /></label>}
      {error && <p className="access-error">{error}</p>}
      {message && <p className="access-message"><CircleCheck size={15} /> {message}</p>}
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={16} /> Procesando…</> : <>{mode === 'login' ? 'Ingresar' : 'Crear mi cuenta'} <ArrowRight size={16} /></>}</button>
    </form>
    <button className="access-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setMessage('') }}>{mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}</button>
  </section></main>
}

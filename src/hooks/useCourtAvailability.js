import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const shortDayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

function toMinutes(time) {
  const [hours = '0', minutes = '0'] = String(time || '00:00').split(':')
  return Number(hours) * 60 + Number(minutes)
}

function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function createDays() {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    return {
      key: toIsoDate(date),
      isoDate: toIsoDate(date),
      date,
      dayOfWeek: date.getDay(),
      dayName: dayNames[date.getDay()],
      shortDayName: shortDayNames[date.getDay()],
      dayNumber: date.getDate(),
      month: new Intl.DateTimeFormat('es-EC', { month: 'short' }).format(date).replace('.', ''),
    }
  })
}

function toSlots(schedules, duration) {
  const slotSet = new Set()
  schedules.forEach((schedule) => {
    const start = toMinutes(schedule.hora_inicio)
    const end = toMinutes(schedule.hora_fin)
    for (let current = start; current + duration <= end; current += duration) slotSet.add(formatTime(current))
  })
  return [...slotSet].sort()
}

function overlaps(start, duration, blocked) {
  const end = toMinutes(start) + duration
  return toMinutes(start) < toMinutes(blocked.hora_fin) && end > toMinutes(blocked.hora_inicio)
}

export function useCourtAvailability(court) {
  const days = useMemo(createDays, [])
  const [selectedDayKey, setSelectedDayKey] = useState(days[0]?.key)
  const [schedules, setSchedules] = useState([])
  const [blocked, setBlocked] = useState([])
  const [isLoading, setIsLoading] = useState(Boolean(court && supabase))
  const [error, setError] = useState(null)
  const [reloadIndex, setReloadIndex] = useState(0)
  const reload = useCallback(() => setReloadIndex((current) => current + 1), [])

  useEffect(() => {
    if (!court || !supabase) return
    let isCurrent = true
    setIsLoading(true)

    async function loadAvailability() {
      const firstDay = days[0]?.isoDate
      const lastDay = days.at(-1)?.isoDate
      const [scheduleResponse, blockedResponse] = await Promise.all([
        supabase.from('demo_horarios_canchas').select('id, dia_semana, hora_inicio, hora_fin').eq('cancha_id', court.id).eq('activo', true).order('hora_inicio'),
        supabase.rpc('demo_horarios_bloqueados', { p_cancha_id: court.id, p_desde: firstDay, p_hasta: lastDay }),
      ])

      if (!isCurrent) return
      if (scheduleResponse.error || blockedResponse.error) {
        setSchedules([])
        setBlocked([])
        setError('No se pudieron consultar los horarios disponibles todavía.')
      } else {
        setSchedules(scheduleResponse.data || [])
        setBlocked(blockedResponse.data || [])
        setError(null)
      }
      setIsLoading(false)
    }

    loadAvailability()
    return () => { isCurrent = false }
  }, [court?.id, days, reloadIndex])

  const selectedDay = days.find((day) => day.key === selectedDayKey) || days[0]
  const selectedSchedules = schedules.filter((schedule) => schedule.dia_semana === selectedDay?.dayOfWeek)
  const configuredSlots = toSlots(selectedSchedules, court?.duration || 60)
  const blockedForDay = blocked.filter((item) => item.fecha === selectedDay?.isoDate)
  const slots = configuredSlots.filter((slot) => !blockedForDay.some((item) => overlaps(slot, court?.duration || 60, item)))

  return { days, selectedDay, selectedDayKey, setSelectedDayKey, slots, isLoading, error, reload }
}

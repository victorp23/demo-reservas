import { CalendarDays, LayoutDashboard, MessageCircle, Trophy } from 'lucide-react'

export const complex = {
  name: 'Complejo Billares de Bugs Bunny',
  location: 'San Antonio de Pichincha',
  logo: '/billas.png',
}

export const courts = [{
  id: 1,
  name: 'Cancha sintética principal',
  type: complex.name,
  price: 'Valor por confirmar',
  tone: 'lime',
  slots: ['17:00', '18:00', '20:00', '21:00'],
}]

export const dashboardStats = [
  ['Reservas esta semana', '86', '+18%'],
  ['Ocupación promedio', '78%', '+9%'],
  ['Solicitudes por WhatsApp', '42', 'Hoy'],
]

export const agendaItems = [
  ['17:00', 'Cancha sintética', 'Horario reservado'],
  ['19:00', 'Cancha sintética', 'Horario reservado'],
  ['20:00', 'Cancha sintética', 'Horario disponible'],
]

export const featureItems = [
  { icon: CalendarDays, title: 'Reservas sin enredos', text: 'Tu cliente escoge cancha, fecha y horario desde el celular.' },
  { icon: MessageCircle, title: 'Bot de WhatsApp', text: 'Responde al instante, confirma horarios y reduce llamadas repetidas.' },
  { icon: LayoutDashboard, title: 'Panel del complejo', text: 'Visualiza agenda, ocupación, clientes y solicitudes en un solo lugar.' },
  { icon: Trophy, title: 'Torneos organizados', text: 'Crea campeonatos, tablas, resultados y calendario de partidos.' },
]

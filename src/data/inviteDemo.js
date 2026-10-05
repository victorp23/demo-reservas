export const inviteDemo = {
  event: {
    slug: 'sofia-y-mateo',
    event_type: 'CANGREJADA',
    title: 'La Gran Cangrejada',
    subtitle: 'Auxilio Mecánico FC',
    host_names: 'Auxilio Mecánico FC',
    description: 'Una cangrejada para compartir entre amigos y familia.',
    starts_at: '2026-10-10T10:00:00-05:00',
    venue_name: 'Billares de Bugs Bunny',
    venue_address: 'Julián Arbaiza y y, 170312 Quito',
    maps_url: 'https://share.google/HYLoMw1mAGo2r75MB',
  },
  sections: [
    { section_type: 'STORY', title: 'Nuestra historia', content: { text: 'Desde aquel primer café hasta este día, cada capítulo nos trajo aquí.' } },
    { section_type: 'SCHEDULE', title: 'El gran día', content: { items: [{ time: '17:00', label: 'Ceremonia' }, { time: '18:30', label: 'Recepción' }, { time: '20:00', label: 'Cena y celebración' }] } },
  ],
  media: [
    { id: 'one', kind: 'IMAGE', public_url: '/img/fondo.jpg', alt_text: 'Celebración' },
    { id: 'two', kind: 'IMAGE', public_url: '/img/cancha1.jpg', alt_text: 'Recuerdo de la pareja' },
    { id: 'three', kind: 'IMAGE', public_url: '/img/cancha2.jpg', alt_text: 'Momentos especiales' },
  ],
}

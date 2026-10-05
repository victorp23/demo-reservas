import { inviteDemo } from '../data/inviteDemo'

const storageKey = 'auxilio-invites-events'

export function slugify(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mi-evento'
}

export function getStoredInvites() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export function saveInvite(event) {
  const invites = getStoredInvites().filter((item) => item.slug !== event.slug)
  const next = [event, ...invites]
  localStorage.setItem(storageKey, JSON.stringify(next))
  return event
}

export function findInvite(slug) {
  return getStoredInvites().find((item) => item.event.slug === slug) || (slug === inviteDemo.event.slug ? inviteDemo : null)
}

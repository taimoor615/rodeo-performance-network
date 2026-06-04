/**
 * Placeholder image URLs when WordPress has no featured image.
 * Uses placehold.co with RPN colors (blue #002868, white #FFFFFF).
 */

const BASE = 'https://placehold.co'
const BG = '002868'
const FG = 'FFFFFF'

export function riderPlaceholder(name = 'Rider') {
  return `${BASE}/400x400/${BG}/${FG}?text=${encodeURIComponent(name)}`
}

export function animalPlaceholder(type = 'Animal') {
  return `${BASE}/400x400/${BG}/${FG}?text=${encodeURIComponent(type)}`
}

export function eventPlaceholder(title = 'Event') {
  return `${BASE}/400x400/${BG}/${FG}?text=${encodeURIComponent(title)}`
}

export function pickupTeamPlaceholder(name = 'Team') {
  return `${BASE}/400x400/${BG}/${FG}?text=${encodeURIComponent(name)}`
}

export function getRiderImage(rider) {
  const url = rider._embedded?.['wp:featuredmedia']?.[0]?.source_url
  if (url) return url
  const name = rider.title?.rendered ? rider.title.rendered.replace(/<[^>]+>/g, '').trim() : 'Rider'
  return riderPlaceholder(name)
}

export function getAnimalImage(animal) {
  const url = animal._embedded?.['wp:featuredmedia']?.[0]?.source_url
  if (url) return url
  const type = animal.meta?.animal_type ?? animal.acf?.animal_type ?? 'Animal'
  return animalPlaceholder(type)
}

export function getEventImage(event) {
  if (event.image_url) return event.image_url
  const title = (event.title && (typeof event.title === 'string' ? event.title : event.title.rendered)) ? String(event.title).replace(/<[^>]+>/g, '').trim() : 'Event'
  return eventPlaceholder(title)
}

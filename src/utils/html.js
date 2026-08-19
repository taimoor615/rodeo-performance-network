/**
 * WordPress REST API returns titles, excerpts, and term names with HTML
 * entities encoded (e.g. "Horses &amp; The Future", "It&#8217;s"). Decode
 * them before rendering as plain text — dangerouslySetInnerHTML handles
 * this automatically, but plain JSX text content does not.
 */
export function decodeHtmlEntities(str) {
  if (!str) return ''
  const el = document.createElement('textarea')
  el.innerHTML = str
  return el.value
}

/** Strips HTML tags and decodes entities — for excerpts/titles used as plain text. */
export function stripHtml(html) {
  if (!html) return ''
  return decodeHtmlEntities(String(html).replace(/<[^>]+>/g, '')).trim()
}

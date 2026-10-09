import 'server-only'
import { escapeHtml } from '../services/mail'

/** `{{ }}` do Edge: escapa strings; null/undefined são impressos literalmente (template literal). */
export const e = (value: unknown) => (value === null || value === undefined ? String(value) : escapeHtml(value))

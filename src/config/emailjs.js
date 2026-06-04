/**
 * EmailJS configuration
 * ──────────────────────────────────────────────────────────────────────────
 * Replace the three placeholder strings below with your real credentials
 * from https://dashboard.emailjs.com
 *
 * Where to find each value:
 *  SERVICE_ID   → Email Services  → your connected service (e.g. Gmail)
 *  TEMPLATE_ID  → Email Templates → your "registration" template
 *  PUBLIC_KEY   → Account → API Keys → Public Key
 *
 * Template variables your EmailJS template should use:
 *  {{to_email}}    — recipient email address
 *  {{first_name}}  — recipient first name
 *  {{password}}    — generated temporary password
 *  {{login_url}}   — link to the login page
 * ──────────────────────────────────────────────────────────────────────────
 */

export const EMAILJS_CONFIG = {
  SERVICE_ID:  'service_kfvtjek',   // ← replace
  TEMPLATE_ID: 'template_iypgqxr',  // ← replace
  PUBLIC_KEY:  'bOS9exR7ULMqMrF1-',   // ← replace
  // PUBLIC_KEY:  'bOS9exR7sjdfsjsdf',   // ← replace
}

export const LOGIN_URL = '/login'

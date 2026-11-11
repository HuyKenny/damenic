/** The one real contact of the project (forwarded to napis@sbalit.cz, Kenny 11. 11. 2026). Only ever used as a mailto link: no form, nothing is sent from the site. */
export const CONTACT_EMAIL = 'info@damenic.cz';

export const mailto = (subject?: string) => `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

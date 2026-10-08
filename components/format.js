const fmt = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short' });
export const fecha = (iso) => (iso ? fmt.format(new Date(iso)) : '');

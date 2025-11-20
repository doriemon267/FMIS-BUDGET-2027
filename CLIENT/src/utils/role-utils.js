export function prettyRole(role) {
  if (!role) return 'Unassigned';
  const r = String(role).toUpperCase().replace(/_/g, ' ').trim();
  // Capitalize each word
  return r.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ').replace(/Budget/i, 'Budget');
}

export default prettyRole;

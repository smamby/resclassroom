// Utilidades de calendario compartidas por bookings y courses.
// Trabajan con fechas UTC para evitar corrimientos por zona horaria.

// Expande un rango [startDate, endDate] a las fechas concretas (YYYY-MM-DD)
// que caen en los días de la semana indicados (0=Dom..6=Sáb). days vacío = todos.
// Acepta el formato legacy `date` (startDate ausente) de las reservas viejas.
function expandRecurringDates(startDate, endDate, days) {
  const start = startDate || '';
  const end = endDate || start;
  if (!start) return [];
  const s = start.split('-').map(n => parseInt(n, 10));
  const e = end.split('-').map(n => parseInt(n, 10));
  const target = new Set(Array.isArray(days) ? days.map(d => Number(d)) : []);
  const dates = [];
  const cur = new Date(Date.UTC(s[0], s[1] - 1, s[2]));
  const last = new Date(Date.UTC(e[0], e[1] - 1, e[2]));
  while (cur <= last) {
    const dow = cur.getUTCDay();
    if (target.size === 0 || target.has(dow)) {
      dates.push(cur.toISOString().slice(0, 10));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// ¿Dos franjas [aStart,aEnd] y [bStart,bEnd] en la misma fecha se solapan?
function timesOverlap(dateStr, aStart, aEnd, bStart, bEnd) {
  const aS = Date.parse(dateStr + 'T' + aStart + ':00');
  const aE = Date.parse(dateStr + 'T' + aEnd + ':00');
  const bS = Date.parse(dateStr + 'T' + bStart + ':00');
  const bE = Date.parse(dateStr + 'T' + bEnd + ':00');
  return aS < bE && aE > bS;
}

module.exports = { expandRecurringDates, timesOverlap };

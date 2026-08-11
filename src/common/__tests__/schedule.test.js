const { expandRecurringDates, timesOverlap } = require('../schedule');

describe('expandRecurringDates', () => {
  test('expande el rango a los días seleccionados', () => {
    // Mar 2026-08-04 y Jue 2026-08-06 caen en Lun(1), Mar(2), Mié(3) ... probamos días [2,4]
    const dates = expandRecurringDates('2026-08-03', '2026-08-09', [2, 4]);
    expect(dates).toEqual(['2026-08-04', '2026-08-06']);
  });

  test('días vacío = todos los días', () => {
    const dates = expandRecurringDates('2026-08-03', '2026-08-03', []);
    expect(dates).toEqual(['2026-08-03']);
  });

  test('soporta el campo date legacy (startDate ausente)', () => {
    expect(expandRecurringDates(undefined, undefined, [])).toEqual([]);
  });

  test('fecha de inicio mayor a fin devuelve vacío', () => {
    expect(expandRecurringDates('2026-08-09', '2026-08-03', [])).toEqual([]);
  });
});

describe('timesOverlap', () => {
  test('franjas que se solapan', () => {
    expect(timesOverlap('2026-08-04', '19:00', '22:00', '21:00', '23:00')).toBe(true);
  });
  test('franjas contiguas no se solapan', () => {
    expect(timesOverlap('2026-08-04', '19:00', '20:00', '20:00', '21:00')).toBe(false);
  });
  test('franjas separadas no se solapan', () => {
    expect(timesOverlap('2026-08-04', '19:00', '20:00', '21:00', '22:00')).toBe(false);
  });
});

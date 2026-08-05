const { buildMenuItems } = require('../menu');

describe('buildMenuItems', () => {
  test('visitor ve solo items base', () => {
    expect(buildMenuItems(['visitor'])).toEqual(['mi-cuenta', 'logout']);
  });
  test('sin roles ve solo items base', () => {
    expect(buildMenuItems()).toEqual(['mi-cuenta', 'logout']);
    expect(buildMenuItems([])).toEqual(['mi-cuenta', 'logout']);
  });
  test('rol desconocido ve solo items base', () => {
    expect(buildMenuItems(['pirata'])).toEqual(['mi-cuenta', 'logout']);
  });
  test('instructor ve base + mis reservas', () => {
    expect(buildMenuItems(['instructor'])).toEqual(['mi-cuenta', 'mis-reservas', 'logout']);
  });
  test('admin ve base + gestion y mis reservas', () => {
    expect(buildMenuItems(['admin'])).toEqual(['mi-cuenta', 'gestionar-usuarios', 'gestionar-espacios', 'mis-reservas', 'logout']);
  });
  test('subco ve base + votar y cursos', () => {
    expect(buildMenuItems(['subco'])).toEqual(['mi-cuenta', 'votar', 'cursos', 'logout']);
  });
  test('multi-rol (admin + instructor) sin duplicados', () => {
    expect(buildMenuItems(['admin', 'instructor'])).toEqual(['mi-cuenta', 'gestionar-usuarios', 'gestionar-espacios', 'mis-reservas', 'logout']);
  });
});

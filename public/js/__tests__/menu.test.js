const { buildMenuItems, iconForWidth } = require('../menu');

describe('iconForWidth', () => {
  test('ancho menor a 480px elige icono de tres puntos', () => {
    const svg = iconForWidth(375);
    expect(svg).toContain('M13 5C13 4.44772');
    expect(svg).not.toContain('M4 6H20');
  });
  test('ancho mayor o igual a 480px elige icono hamburguesa', () => {
    const svg = iconForWidth(1280);
    expect(svg).toContain('M4 6H20');
    expect(svg).not.toContain('M13 5C13 4.44772');
  });
  test('ancho exacto 480px usa hamburguesa', () => {
    expect(iconForWidth(480)).toContain('M4 6H20');
  });
});

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

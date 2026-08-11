const Course = require('../models/Course');

describe('Course', () => {
  test('requiere título', () => {
    expect(() => new Course({})).toThrow('title es requerido');
    expect(() => new Course({ title: '  ' })).toThrow('title es requerido');
  });

  test('crea un borrador por defecto (status propuesto)', () => {
    const c = new Course({ title: 'Escalada' });
    expect(c.title).toBe('Escalada');
    expect(c.status).toBe('propuesto');
    expect(c.votes).toEqual([]);
    expect(c.schedule.blocks).toEqual([]);
  });

  test('normaliza bloques', () => {
    const c = new Course({ title: 'X', schedule: { startDate: '2026-08-03', endDate: '2026-09-30', blocks: [{ label: 'Teórica', workspaceId: 'a1', days: ['2', 4], startTime: '19:00', endTime: '22:00' }] } });
    expect(c.schedule.blocks[0].days).toEqual([2, 4]);
    expect(c.schedule.blocks[0].isPublicSpace).toBe(false);
  });

  test('acepta bloques de espacio público sin workspaceId', () => {
    const c = new Course({ title: 'X', schedule: { blocks: [{ label: 'Práctica', isPublicSpace: true, workspaceName: 'Parque', days: [6], startTime: '10:00', endTime: '12:00' }] } });
    expect(c.schedule.blocks[0].workspaceId).toBeNull();
    expect(c.schedule.blocks[0].isPublicSpace).toBe(true);
  });

  test('coordinator, price y capacity tienen defaults', () => {
    const c = new Course({ title: 'X' });
    expect(c.coordinator).toEqual({ name: '', email: '', phone: '', contactFormUrl: '' });
    expect(c.price).toEqual({ socio: 0, nonSocio: 0 });
    expect(c.capacity).toEqual({ min: 0, max: 0 });
  });
});

const Workspace = require('../Workspace');

describe('Workspace', () => {
  test('should create a workspace with valid parameters', () => {
    const workspace = new Workspace({
      name: 'Aula 101',
      type: 'classroom',
      capacity: 30,
      location: 'Edificio A, piso 2',
      equipment: ['proyector', 'pizarra']
    });
    
    expect(workspace.id).toBeDefined();
    expect(workspace.name).toBe('Aula 101');
    expect(workspace.type).toBe('classroom');
    expect(workspace.capacity).toBe(30);
    expect(workspace.location).toBe('Edificio A, piso 2');
    expect(workspace.equipment).toEqual(['proyector', 'pizarra']);
    expect(workspace.createdAt).toBeInstanceOf(Date);
  });

    test('should throw error when creating workspace without required fields', () => {
      expect(() => new Workspace({})).toThrow('Name is required');
      expect(() => new Workspace({ name: '' })).toThrow('Name is required');
      expect(() => new Workspace({ name: 'Test', capacity: -5 })).toThrow('Capacity must be a positive integer');
    });
});
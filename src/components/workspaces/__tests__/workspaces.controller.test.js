const WorkspaceController = require('../controller');
const WorkspaceStore = require('../store');

jest.mock('../store');

describe('WorkspaceController permission checks', () => {
  let controller;
  beforeEach(() => {
    controller = new WorkspaceController();
    jest.clearAllMocks();
  });

  test('updateWorkspace returns 403 for visitor', async () => {
    const req = { user: { id: 'visitor1', role: ['visitor'] }, params: { id: 'ws1' }, body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.updateWorkspace(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(WorkspaceStore.prototype.update).not.toHaveBeenCalled();
  });

  test('deleteWorkspace returns 403 for visitor', async () => {
    const req = { user: { id: 'visitor1', role: ['visitor'] }, params: { id: 'ws1' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.deleteWorkspace(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(WorkspaceStore.prototype.delete).not.toHaveBeenCalled();
  });

  test('createWorkspace returns 403 for visitor', async () => {
    const req = { user: { id: 'visitor1', role: ['visitor'] }, body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.createWorkspace(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(WorkspaceStore.prototype.create).not.toHaveBeenCalled();
  });

  test('updateWorkspace returns 403 when no user (unauthenticated)', async () => {
    const req = { user: null, params: { id: 'ws1' }, body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.updateWorkspace(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('updateWorkspace allows instructor', async () => {
    WorkspaceStore.prototype.update.mockResolvedValue({ _id: 'ws1', name: 'Quincho' });
    const req = {
      user: { id: 'instr1', role: ['instructor'] },
      params: { id: 'ws1' },
      body: { name: 'Quincho' }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await controller.updateWorkspace(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(WorkspaceStore.prototype.update).toHaveBeenCalled();
  });
});

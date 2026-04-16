const Workspace = require('./models/Workspace');
const WorkspaceStore = require('./store');

class WorkspaceController {
  constructor() {
    this.store = new WorkspaceStore();
  }

  async createWorkspace(req, res) {
    try {
      const user = req.user;
      if (!user || !Array.isArray(user.role) || !user.role.some(r => ['admin', 'instructor'].includes(r))) {
        return res.status(403).json({ error: 'Unauthorized to create workspaces' });
      }
      const workspaceData = {
        ...req.body,
        createdAt: new Date()
      };
      const workspace = new Workspace(workspaceData);
      const result = await this.store.create(workspace);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getWorkspaceById(req, res) {
    try {
      const workspace = await this.store.findById(req.params.id);
      if (workspace) {
        res.status(200).json(workspace);
      } else {
        res.status(404).json({ error: 'Workspace not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAllWorkspaces(req, res) {
    try {
      const workspaces = await this.store.findAll();
      res.status(200).json(workspaces);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateWorkspace(req, res) {
    try {
      const updates = {
        ...req.body,
        updatedAt: new Date()
      };
      const workspace = await this.store.update(req.params.id, updates);
      if (workspace) {
        res.status(200).json(workspace);
      } else {
        res.status(404).json({ error: 'Workspace not found' });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteWorkspace(req, res) {
    try {
      const result = await this.store.delete(req.params.id);
      if (result) {
        res.status(200).json({ message: 'Workspace deleted successfully' });
      } else {
        res.status(404).json({ error: 'Workspace not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = WorkspaceController;

const { Router } = require('express');
const WorkspaceController = require('./controller');
const auth = require('../../middleware/authMiddleware');

const router = Router();
let _controller;

function getController() {
  if (!_controller) {
    _controller = new WorkspaceController();
  }
  return _controller;
}

// Public: List all workspaces (for visitors)
router.get('/', (req, res) => getController().getAllWorkspaces(req, res));

// Public: Get single workspace (for visitors)
router.get('/:id', (req, res) => getController().getWorkspaceById(req, res));

// Protected: Create workspace (instructor/admin only)
router.post('/', auth.authenticate, (req, res) => getController().createWorkspace(req, res));

// Protected: Update workspace (instructor/admin only - ownership check in controller)
router.put('/:id', auth.authenticate, (req, res) => getController().updateWorkspace(req, res));

// Protected: Delete workspace (instructor/admin only)
router.delete('/:id', auth.authenticate, (req, res) => getController().deleteWorkspace(req, res));

module.exports = router;

const { Router } = require('express');
const WorkspaceController = require('./controller');

const router = Router();
let _controller;

function getController() {
  if (!_controller) {
    _controller = new WorkspaceController();
  }
  return _controller;
}

router.get('/', (req, res) => getController().getAllWorkspaces(req, res));
router.get('/:id', (req, res) => getController().getWorkspaceById(req, res));
router.post('/', (req, res) => getController().createWorkspace(req, res));
router.put('/:id', (req, res) => getController().updateWorkspace(req, res));
router.delete('/:id', (req, res) => getController().deleteWorkspace(req, res));

module.exports = router;

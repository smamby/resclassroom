const { Router } = require('express');
const UserController = require('./controller');

const router = Router();
const auth = require('../../middleware/authMiddleware');
let _controller;

function getController() {
  if (!_controller) {
    _controller = new UserController();
  }
  return _controller;
}

router.get('/', auth.authenticateAdmin, (req, res) => getController().getAllUsers(req, res));
router.get('/:id', (req, res) => getController().getUserById(req, res));
router.get('/email/:email', (req, res) => getController().getUserByEmail(req, res));
router.post('/', (req, res) => getController().createUser(req, res));
router.post('/:id/promote', auth.authenticate, (req, res) => getController().promoteUser(req, res));
router.put('/:id', (req, res) => getController().updateUser(req, res));
router.delete('/:id', (req, res) => getController().deleteUser(req, res));

module.exports = router;

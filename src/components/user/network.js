const { Router } = require('express');
const UserController = require('./controller');
const auth = require('../../middleware/authMiddleware');

const router = Router();
let _controller;

function getController() {
  if (!_controller) {
    _controller = new UserController();
  }
  return _controller;
}

// Self-service "Mi cuenta": siempre van antes de las rutas /:id para no ser capturadas
router.put('/me/profile', auth.authenticate, (req, res) => getController().updateMyProfile(req, res));
router.put('/me/password', auth.authenticate, (req, res) => getController().changeMyPassword(req, res));
router.delete('/me', auth.authenticate, (req, res) => getController().deleteMyAccount(req, res));
router.post('/me/cancel-delete', auth.authenticate, (req, res) => getController().cancelDeleteAccount(req, res));

router.get('/', auth.authenticateAdmin, (req, res) => getController().getAllUsers(req, res));
router.get('/:id', auth.authenticate, (req, res) => getController().getUserById(req, res));
router.get('/email/:email', (req, res) => getController().getUserByEmail(req, res));
router.post('/', auth.authenticateAdmin, (req, res) => getController().createUser(req, res));
router.post('/:id/promote', auth.authenticateAdmin, (req, res) => getController().promoteUser(req, res));
router.put('/:id', auth.authenticate, (req, res) => getController().updateUser(req, res));
router.delete('/:id', auth.authenticateAdmin, (req, res) => getController().deleteUser(req, res));

// Router público para confirmar el borrado de cuenta desde el email (el token es la credencial)
const deleteAccountRouter = Router();
deleteAccountRouter.post('/:token', (req, res) => getController().deleteAccountByToken(req, res));

module.exports = router;
module.exports.deleteAccountRouter = deleteAccountRouter;

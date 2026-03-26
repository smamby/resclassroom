const { Router } = require('express');
const AuthController = require('./controller');

const router = Router();
let _controller;

function getController() {
  if (!_controller) {
    _controller = new AuthController();
  }
  return _controller;
}

router.post('/register', (req, res) => getController().register(req, res));
router.post('/login', (req, res) => getController().login(req, res));
router.post('/logout', (req, res) => getController().logout(req, res));

module.exports = router;

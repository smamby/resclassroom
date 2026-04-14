const { Router } = require('express');
const ResetPasswordController = require('./controller');

const router = Router();
let _controller;

function getController() {
  if (!_controller) {
    _controller = new ResetPasswordController();
  }
  return _controller;
}

router.post('/forgot-password', (req, res) => getController().forgotPassword(req, res));
router.post('/reset-password/:token', (req, res) => getController().resetPassword(req, res));

module.exports = router;

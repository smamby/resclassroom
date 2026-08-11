const { Router } = require('express');
const CourseController = require('./controller');
const auth = require('../../middleware/authMiddleware');

const router = Router();
let _controller;

function getController() {
  if (!_controller) {
    _controller = new CourseController();
  }
  return _controller;
}

// Lectura (visitor y roles): la visibilidad por rol la decide el controller.
router.get('/', auth.authenticate, (req, res) => getController().listCourses(req, res));
router.get('/pending-count', auth.authenticate, (req, res) => getController().pendingCount(req, res));
router.get('/check-conflicts', auth.authenticate, (req, res) => getController().checkConflicts(req, res));
router.get('/:id', auth.authenticate, (req, res) => getController().getCourseById(req, res));

// Escritura (roles validados en el controller).
router.post('/', auth.authenticate, (req, res) => getController().createCourse(req, res));
router.put('/:id', auth.authenticate, (req, res) => getController().updateCourse(req, res));
router.post('/:id/submit', auth.authenticate, (req, res) => getController().submitCourse(req, res));
router.post('/:id/vote', auth.authenticate, (req, res) => getController().voteCourse(req, res));
router.post('/:id/withdraw', auth.authenticate, (req, res) => getController().withdrawCourse(req, res));
router.post('/:id/back-to-draft', auth.authenticate, (req, res) => getController().backToDraft(req, res));
router.post('/:id/cancel', auth.authenticate, (req, res) => getController().cancelCourse(req, res));
router.delete('/:id', auth.authenticate, (req, res) => getController().deleteCourse(req, res));

module.exports = router;

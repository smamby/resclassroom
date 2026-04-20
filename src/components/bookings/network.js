const { Router } = require('express');
const BookingController = require('./controller');
const auth = require('../../middleware/authMiddleware');

const router = Router();
let _controller;

function getController() {
  if (!_controller) {
    _controller = new BookingController();
  }
  return _controller;
}

// Public: List all bookings (for visitors - no auth required)
router.get('/', (req, res) => getController().getAllBookings(req, res));

// Protected: Create booking (instructor/admin only)
router.post('/', auth.authenticate, (req, res) => getController().createBooking(req, res));

// Public: Get bookings by workspace (for visitors)
router.get('/workspace/:workspaceId', (req, res) => getController().getBookingsByWorkspace(req, res));

// Public: Get single booking (for visitors)
router.get('/:id', (req, res) => getController().getBookingById(req, res));

// Protected: Update booking (auth + ownership check in controller)
router.put('/:id', auth.authenticate, (req, res) => getController().updateBooking(req, res));

// Protected: Delete booking (auth + ownership check in controller)
router.delete('/:id', auth.authenticate, (req, res) => getController().deleteBooking(req, res));

module.exports = router;

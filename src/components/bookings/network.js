const { Router } = require('express');
const BookingController = require('./controller');

const router = Router();
let _controller;

function getController() {
  if (!_controller) {
    _controller = new BookingController();
  }
  return _controller;
}

// List all bookings or create a new booking
router.get('/', (req, res) => getController().getAllBookings(req, res));
router.post('/', (req, res) => getController().createBooking(req, res));

// Operations on a single booking
router.get('/:id', (req, res) => getController().getBookingById(req, res));
router.put('/:id', (req, res) => getController().updateBooking(req, res));
router.delete('/:id', (req, res) => getController().deleteBooking(req, res));

module.exports = router;

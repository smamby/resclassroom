// Lightweight frontend API wrapper for bookings (exposed globally)
window.BookingsApi = {
  createBooking: (data) => fetch('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  }).then(res => res.json()),
  getAllBookings: () => fetch('/bookings', { credentials: 'include' }).then(res => res.json()),
  getBooking: (id) => fetch(`/bookings/${id}`, { credentials: 'include' }).then(res => res.json()),
  updateBooking: (id, data) => fetch(`/bookings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  }).then(res => res.json()),
  deleteBooking: (id) => fetch(`/bookings/${id}`, { method: 'DELETE', credentials: 'include' }).then(res => res.json())
};

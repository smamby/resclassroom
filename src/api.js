// Frontend API wrappers for Bookings CRUD

async function jsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  return data;
}

class BookingsApi {
  static async getAllBookings() {
    const res = await fetch('/bookings', { credentials: 'include' });
    return jsonResponse(res);
  }

  static async getBooking(id) {
    const res = await fetch(`/bookings/${id}`, { credentials: 'include' });
    return jsonResponse(res);
  }

  static async createBooking(data) {
    const res = await fetch('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return jsonResponse(res);
  }

  static async updateBooking(id, data) {
    const res = await fetch(`/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return jsonResponse(res);
  }

  static async deleteBooking(id) {
    const res = await fetch(`/bookings/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return jsonResponse(res);
  }
}

// Expose as global for non-module environments if needed
if (typeof window !== 'undefined' && !window.BookingsApi) {
  window.BookingsApi = BookingsApi;
}

module.exports = BookingsApi;

const Booking = require('./models/Booking');
const BookingStore = require('./store');

class BookingController {
  constructor() {
    this.store = new BookingStore();
  }

  // List bookings with optional filters
  async getAllBookings(req, res) {
    try {
      const all = await this.store.findAll();
      let results = all;

      console.log('results get all bookings', results);

      if (req.query.workspaceId) {
        results = results.filter(b => String(b.workspaceId) === String(req.query.workspaceId));
      }
      console.log('results after filter by workspace', results);
      if (req.query.actividad) {
        results = results.filter(b => b.actividad === req.query.actividad);
      }
      console.log('results after filter by actividad', results);
      if (req.query.dayOfWeek !== undefined) {
        const dow = parseInt(req.query.dayOfWeek, 10);
        results = results.filter(b => {
          const dateField = b.startDate || b.date;
          const d = new Date(dateField);
          return d.getDay() === dow;
        });
      }
      console.log('results after filter by day of week', results);
      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getBookingById(req, res) {
    try {
      const booking = await this.store.findById(req.params.id);
      if (booking) {
        res.status(200).json(booking);
      } else {
        res.status(404).json({ error: 'Booking not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createBooking(req, res) {
    try {
      // Authentication/authorization
      const user = req.user;
      if (!user || !['admin', 'instructor'].includes(user.role)) {
        return res.status(403).json({ error: 'Unauthorized to create bookings' });
      }

      // Required fields (now with recurrence)
      const { workspaceId, startDate, endDate, startTime, endTime, days, actividad, notes } = req.body;
      if (!workspaceId || !startDate || !endDate || !startTime || !endTime || !Array.isArray(days) || !actividad) {
        return res.status(400).json({ error: 'workspaceId, startDate, endDate, startTime, endTime, days array y actividad son requeridos' });
      }

      // Check workspace existence in controller (as requested)
      const db = require('../../db').getDb();
      const workspacesCol = db.collection('workspaces');
      const workspace = await workspacesCol.findOne({ $or: [{ _id: workspaceId }, { id: workspaceId }] });
      if (!workspace) {
        return res.status(400).json({ error: 'Workspace not found' });
      }

      // Basic date/time validation
      if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: 'startDate must be <= endDate' });
      }
      if (startTime >= endTime) {
        return res.status(400).json({ error: 'startTime must be earlier than endTime' });
      }

      // Recurrence: compute all dates in [startDate, endDate] that match selected days
      const selectedDays = new Set(days.map(d => Number(d)));
      const dateList = [];
      let cur = new Date(startDate);
      const endD = new Date(endDate);
      while (cur <= endD) {
        const iso = cur.toISOString().slice(0,10);
        const dow = cur.getDay();
        if (selectedDays.has(dow)) dateList.push(iso);
        cur.setDate(cur.getDate() + 1);
      }

      // Check conflicts against existing bookings for the workspace across dates
      const existingList = await this.store.findAll();
      for (const dateStr of dateList) {
        // find existing bookings for this date range crossing; legacy field handling: exact date or range
        const listForDate = existingList.filter(b => b.workspaceId === workspaceId && (
          (b.startDate && b.endDate && dateStr >= b.startDate && dateStr <= b.endDate) ||
          (b.date === dateStr)
        ));
        for (const eb of listForDate) {
          const eStart = eb.startTime;
          const eEnd = eb.endTime;
          if (startTime < eEnd && endTime > eStart) {
            return res.status(409).json({ error: 'La reserva solapa con otra reserva para este workspace en una fecha del rango' });
          }
        }
      }
      console.log('color', req.body.color);
      // Create a booking entry with recurrence window (single entry that represents the range)
      const booking = new Booking({
        workspaceId,
        startDate,
        endDate,
        startTime,
        endTime,
        userId: user.id,
        actividad,
        notes: notes || '',
        color: req.body.color, //|| '#3B82F6',
        days: days,
        status: 'confirmed',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      const result = await this.store.create(booking);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateBooking(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      const existing = await this.store.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Authorization: admin can modify any, instructor only their own
      if (user.role === 'instructor' && String(existing.userId) !== String(user.id)) {
        return res.status(403).json({ error: 'Insufficient privileges to modify this booking' });
      }

      // Build updates; do not allow changing owner implicitly
      const updates = {
        ...req.body,
        updatedAt: new Date()
      };

      // If date/startTime/endTime/workspaceId/actividad are being updated, validate solape
      const workspaceId = updates.workspaceId || existing.workspaceId;
      const date = updates.date || existing.date;
      const startTime = updates.startTime || existing.startTime;
      const endTime = updates.endTime || existing.endTime;
      const actividad = updates.actividad || existing.actividad;

      const otherBookings = await this.store.findByWorkspaceAndDate(workspaceId, date);
      if (otherBookings && otherBookings.length > 0) {
        const newStart = new Date(`${date}T${startTime}:00`);
        const newEnd = new Date(`${date}T${endTime}:00`);
        for (const b of otherBookings) {
          if (String(b._id) === String(existing._id)) continue;
          const es = new Date(`${b.date}T${b.startTime}:00`);
          const ee = new Date(`${b.date}T${b.endTime}:00`);
          if (newStart < ee && newEnd > es) {
            return res.status(409).json({ error: 'La reserva solapa con otra reserva para este workspace en esa fecha.' });
          }
        }
      }

      const updated = await this.store.update(req.params.id, updates);
      if (updated) {
        res.status(200).json(updated.value || updated);
      } else {
        res.status(404).json({ error: 'Booking not found' });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteBooking(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      const existing = await this.store.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      // Admin can delete any, instructor only their own bookings
      if (user.role === 'instructor' && String(existing.userId) !== String(user.id)) {
        return res.status(403).json({ error: 'Insufficient privileges to delete this booking' });
      }
      const result = await this.store.delete(req.params.id);
      if (result) {
        res.status(200).json({ message: 'Booking deleted successfully' });
      } else {
        res.status(404).json({ error: 'Booking not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = BookingController;

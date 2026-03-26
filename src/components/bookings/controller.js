const Booking = require('./models/Booking');
const BookingStore = require('./store');

class BookingController {
  constructor() {
    this.store = new BookingStore();
  }

  // Helper: generate dates between startDate and endDate inclusive, filtered by days (0=Sun..6=Sat) using local time
  generateDates(startDate, endDate, days) {
    const s = startDate.split('-').map(n => parseInt(n, 10));
    const e = endDate.split('-').map(n => parseInt(n, 10));
    // Start and end as local dates
    const startLocal = new Date(s[0], s[1] - 1, s[2]);
    const endLocal = new Date(e[0], e[1] - 1, e[2]);
    const target = new Set(Array.isArray(days) ? days.map(d => Number(d)) : []);
    const dates = [];
    for (let d = new Date(startLocal); d <= endLocal; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (target.size === 0 || target.has(dow)) {
        const dateLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.push(dateLocal);
      }
    }
    return dates;
  }

  // Given a booking eb, generate all dates (YYYY-MM-DD) for its range
  _expandBookingDates(eb) {
    const dates = [];
    let ebDates = [];
    if (eb.startDate && eb.endDate) {
      let cur = new Date(eb.startDate);
      const end = new Date(eb.endDate);
      while (cur <= end) {
        const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        ebDates.push(ds);
        cur.setDate(cur.getDate() + 1);
      }
    } else if (eb.date) {
      ebDates.push(eb.date);
    }
    // apply days restriction if present
    const desiredDays = Array.isArray(eb.days) ? eb.days : [];
    for (const ds of ebDates) {
      const d = new Date(ds); // local date
      const dow = d.getDay();
      if (desiredDays.length === 0 || desiredDays.includes(dow)) dates.push(ds);
    }
    return dates;
  }

  // Helpers for UTC date arithmetic to avoid timezone offsets
  _dateUTC(dateStr) {
    // returns a Date in UTC for YYYY-MM-DD
    const parts = dateStr.split('-').map(n => parseInt(n, 10));
    return new Date(Date.UTC(parts[0], parts[1]-1, parts[2]));
  }
  _dowUTC(dateStr) {
    const d = this._dateUTC(dateStr);
    return d.getUTCDay();
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

      // Recurrence: compute all dates in [startDate, endDate] that match selected days using local date arithmetic
      const dateList = [];
      const s = startDate.split('-').map(n => parseInt(n, 10)); // [Y, M, D]
      const e = endDate.split('-').map(n => parseInt(n, 10));
      let curLocal = new Date(s[0], s[1]-1, s[2]);
      const endLocal = new Date(e[0], e[1]-1, e[2]);
      const newDaysSet = new Set(days.map(d => Number(d)));
      while (curLocal <= endLocal) {
        const dow = curLocal.getDay();
        if (newDaysSet.size === 0 || newDaysSet.has(dow)) {
          const ds = `${curLocal.getFullYear()}-${String(curLocal.getMonth()+1).padStart(2, '0')}-${String(curLocal.getDate()).padStart(2, '0')}`;
          dateList.push(ds);
        }
        curLocal.setDate(curLocal.getDate() + 1);
      }

      // Check conflicts against existing bookings for the workspace across dates (per date logic)
      const existingList = await this.store.findAll();
      let conflictReason = null;
      for (const eb of existingList.filter(b => b.workspaceId === workspaceId)) {
        // expand eb dates
        const ebDates = this._expandBookingDates(eb);
        const ebDays = Array.isArray(eb.days) ? eb.days : [];
        const ebDaysSet = new Set(ebDays);
        for (const dateStr of dateList) {
          if (!ebDates.includes(dateStr)) continue;
          // check dow match with eb.days
          const dow = this._dowUTC(dateStr);
          if (ebDaysSet.size > 0 && !ebDaysSet.has(dow)) continue;
          // time overlap check for this date
          const newStart = new Date(dateStr + 'T' + startTime + ':00Z');
          const newEnd = new Date(dateStr + 'T' + endTime + ':00Z');
          const es = new Date(dateStr + 'T' + eb.startTime + ':00Z');
          const ee = new Date(dateStr + 'T' + eb.endTime + ':00Z');
          if (newStart < ee && newEnd > es) {
            conflictReason = `Solape con reserva existente ${eb._id || eb.id} en fecha ${dateStr}`;
            break;
          }
        }
        if (conflictReason) break;
      }
      if (conflictReason) {
        return res.status(409).json({ error: conflictReason });
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

const { ObjectId } = require('mongodb');
const Booking = require('./models/Booking');
const BookingStore = require('./store');
const UserStore = require('../user/store');

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id)) {
    return new ObjectId(id);
  }
  return id;
}

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
    if (!eb.startDate || !eb.endDate) {
      if (eb.date) return [eb.date];
      return [];
    }
    
    // Parse usando el mismo approach que createBooking (fecha local)
    const s = eb.startDate.split('-').map(n => parseInt(n, 10));
    const e = eb.endDate.split('-').map(n => parseInt(n, 10));
    let cur = new Date(s[0], s[1] - 1, s[2]);
    const end = new Date(e[0], e[1] - 1, e[2]);
    
    const desiredDays = Array.isArray(eb.days) ? eb.days : [];
    while (cur <= end) {
      const dow = cur.getDay();
      if (desiredDays.length === 0 || desiredDays.includes(dow)) {
        const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        dates.push(ds);
      }
      cur.setDate(cur.getDate() + 1);
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

  // Verifica solapamiento de horarios para una reserva
  // Retorna mensaje de error si hay conflicto, null si no hay
  async checkOverlap(workspaceId, dateList, days, startTime, endTime, excludeBookingId = null) {
    const bookings = await this.store.findByWorkspace(workspaceId);
    const newDaysSet = new Set(days.map(d => Number(d)));
    
    for (const eb of bookings) {
      if (excludeBookingId && String(eb._id) === String(excludeBookingId)) continue;
      
      const ebDates = this._expandBookingDates(eb);
      const ebDaysSet = new Set(eb.days || []);
      
      for (const dateStr of dateList) {
        if (!ebDates.includes(dateStr)) continue;
        
        const dowUTC = this._dowUTC(dateStr);
        if (ebDaysSet.size > 0 && !ebDaysSet.has(dowUTC)) continue;
        
        const newStart = new Date(dateStr + 'T' + startTime + ':00');
        const newEnd = new Date(dateStr + 'T' + endTime + ':00');
        const es = new Date(dateStr + 'T' + eb.startTime + ':00');
        const ee = new Date(dateStr + 'T' + eb.endTime + ':00');
        
        if (newStart < ee && newEnd > es) {
          // Mensaje simplificado sin ID
          return `Solape el ${dateStr} de ${startTime} a ${endTime}`;
        }
      }
    }
    return null;
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

  async getBookingsByWorkspace(req, res) {
    try {
      const results = await this.store.findByWorkspace(req.params.workspaceId);
      res.status(200).json(results);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async createBooking(req, res) {
    try {
      // Authentication/authorization
      const user = req.user;
      if (!user || !Array.isArray(user.role) || !user.role.some(r => ['admin', 'instructor'].includes(r))) {
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
      const wsOid = toObjectId(workspaceId);
      const workspace = await workspacesCol.findOne({ _id: wsOid });
      if (!workspace) {
        return res.status(400).json({ error: 'Workspace not found' });
      }

      // Basic date/time validation
      if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: 'la fecha de inicio debe ser anterior a la de finalización' }); // 'startDate must be <= endDate' });
      }
      if (startTime >= endTime) {
        return res.status(400).json({ error: 'la hora de inicio debe ser anterior a la de finalización' }); // 'startTime must be earlier than endTime' });
      }

      // Recurrence: compute all dates in [startDate, endDate] that match selected days using UTC date arithmetic
      const dateList = [];
      const s = startDate.split('-').map(n => parseInt(n, 10));
      const e = endDate.split('-').map(n => parseInt(n, 10));
      let cur = new Date(Date.UTC(s[0], s[1]-1, s[2]));
      const end = new Date(Date.UTC(e[0], e[1]-1, e[2]));
      const newDaysSet = new Set(days.map(d => Number(d)));
      
      while (cur <= end) {
        const dow = cur.getUTCDay();
        if (newDaysSet.size === 0 || newDaysSet.has(dow)) {
          const ds = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`;
          dateList.push(ds);
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      // Check conflicts using reusable method
      const conflictReason = await this.checkOverlap(workspaceId, dateList, days, startTime, endTime);
      if (conflictReason) {
        return res.status(409).json({ error: conflictReason });
      }
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

      // Authorization: positive check - admin OR (instructor AND owner)
      const userRoles = Array.isArray(user.role) ? user.role : [];
      const canModify =
        userRoles.includes('admin') ||
        (userRoles.includes('instructor') && String(existing.userId) === String(user.id));
      if (!canModify) {
        return res.status(403).json({ error: 'Insufficient privileges to modify this booking' });
      }

      // Verify admin claim in DB to prevent sessionStorage manipulation
      if (userRoles.includes('admin')) {
        const userStore = new UserStore();
        const dbUser = await userStore.findById(user.id);
        const dbRoles = Array.isArray(dbUser.role) ? dbUser.role : [];
        if (!dbUser || !dbRoles.includes('admin')) {
          return res.status(403).json({ error: 'Invalid admin credentials' });
        }
      }

      // Build updates; do not allow changing owner implicitly
      const updates = {
        ...req.body,
        updatedAt: new Date(),
        // Audit information for edits
        modified: true,
        modifiedAt: new Date(),
        modifiedByName: user.name || user.username || ''
      };

      // Reconstruct dateList for overlap check
      const workspaceId = updates.workspaceId || existing.workspaceId;
      const startTime = updates.startTime || existing.startTime;
      const endTime = updates.endTime || existing.endTime;
      
      const updateStartDate = updates.startDate || existing.startDate;
      const updateEndDate = updates.endDate || existing.endDate;
      const updateDays = updates.days || existing.days || [];
      
      // Generate dateList using same UTC logic as createBooking
      const updateDateList = [];
      if (updateStartDate && updateEndDate) {
        const us = updateStartDate.split('-').map(n => parseInt(n, 10));
        const ue = updateEndDate.split('-').map(n => parseInt(n, 10));
        let uc = new Date(Date.UTC(us[0], us[1]-1, us[2]));
        const ueEnd = new Date(Date.UTC(ue[0], ue[1]-1, ue[2]));
        const udSet = new Set(updateDays.map(d => Number(d)));
        while (uc <= ueEnd) {
          const dow = uc.getUTCDay();
          if (udSet.size === 0 || udSet.has(dow)) {
            const ds = `${uc.getUTCFullYear()}-${String(uc.getUTCMonth()+1).padStart(2,'0')}-${String(uc.getUTCDate()).padStart(2,'0')}`;
            updateDateList.push(ds);
          }
          uc.setUTCDate(uc.getUTCDate() + 1);
        }
      }

      // Check conflicts using reusable method (exclude current booking being updated)
      const conflictReason = await this.checkOverlap(
        workspaceId,
        updateDateList,
        updateDays,
        startTime,
        endTime,
        existing._id
      );
      if (conflictReason) {
        return res.status(409).json({ error: conflictReason });
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
      // Authorization: positive check - admin OR (instructor AND owner)
      const userRoles = Array.isArray(user.role) ? user.role : [];
      const canDelete =
        userRoles.includes('admin') ||
        (userRoles.includes('instructor') && String(existing.userId) === String(user.id));
      if (!canDelete) {
        return res.status(403).json({ error: 'Insufficient privileges to delete this booking' });
      }

      // Verify admin claim in DB to prevent sessionStorage manipulation
      if (userRoles.includes('admin')) {
        const userStore = new UserStore();
        const dbUser = await userStore.findById(user.id);
        const dbRoles = Array.isArray(dbUser.role) ? dbUser.role : [];
        if (!dbUser || !dbRoles.includes('admin')) {
          return res.status(403).json({ error: 'Invalid admin credentials' });
        }
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

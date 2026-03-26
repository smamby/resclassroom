class Booking {
  constructor(data) {
    // Prefer new fields: startDate, endDate, startTime, endTime
    // Fallback to legacy fields if newer ones are not provided
    this.workspaceId = data.workspaceId;
    this.startDate = data.startDate || data.date; // YYYY-MM-DD
    this.endDate = data.endDate || data.date; // YYYY-MM-DD
    this.startTime = data.startTime; // HH:mm
    this.endTime = data.endTime; // HH:mm
    this.userId = data.userId;
    this.actividad = data.actividad; // activity
    this.color = data.color || '#999'; // color used in calendar
    this.days = Array.isArray(data.days) ? data.days : [];

    // Optional/auxiliary
    this.notes = data.notes || '';
    this.status = data.status || 'confirmed';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();

    // Backward compatible id field
    this.id = data.id || null;
  }
}

module.exports = Booking;

class Booking {
  constructor(data) {
    // Required fields
    this.workspaceId = data.workspaceId;
    this.date = data.date; // YYYY-MM-DD
    this.startTime = data.startTime; // HH:mm
    this.endTime = data.endTime; // HH:mm
    this.userId = data.userId;
    this.actividad = data.actividad; // new required field: activity

    // Optional/auxiliary
    this.notes = data.notes || '';
    this.status = data.status || 'confirmed';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();

    // Internal id if provided
    this.id = data.id || null;
  }
}

module.exports = Booking;

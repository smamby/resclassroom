class Workspace {
  constructor(data) {
    if (!data.name || data.name.trim() === '') {
      throw new Error('Name is required');
    }
    
    if (data.capacity !== undefined && (data.capacity <= 0 || !Number.isInteger(data.capacity))) {
      throw new Error('Capacity must be a positive integer');
    }
    
    this.id = data.id || Math.random().toString(36).substr(2, 9);
    this.name = data.name.trim();
    this.type = data.type || '';
    this.capacity = data.capacity || 0;
    this.location = data.location || '';
    this.equipment = Array.isArray(data.equipment) ? data.equipment : [];
    this.createdBy = data.createdBy || null;
    this.createdAt = data.createdAt || new Date();
  }
}

module.exports = Workspace;
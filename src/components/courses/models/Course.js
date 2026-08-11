// Modelo de curso. El título es lo único obligatorio incluso en borrador:
// sin nombre no hay curso, pero el resto se va completando a lo largo del
// borrador (a veces falta el presupuesto, a veces las fechas).
function normalizeBlock(b = {}) {
  return {
    label: b.label || '',
    workspaceId: b.workspaceId || null,
    workspaceName: b.workspaceName || '',
    location: b.location || '',
    isPublicSpace: !!b.isPublicSpace,
    days: Array.isArray(b.days) ? b.days.map(d => Number(d)) : [],
    startTime: b.startTime || '',
    endTime: b.endTime || ''
  };
}

class Course {
  constructor(data = {}) {
    if (!data.title || !String(data.title).trim()) {
      throw new Error('title es requerido');
    }
    this.title = String(data.title).trim();
    this.type = data.type || '';
    this.description = data.description || '';
    this.proposal = data.proposal || '';
    this.proposalUrl = data.proposalUrl || '';

    this.coordinator = {
      name: data.coordinator && data.coordinator.name != null ? data.coordinator.name : '',
      email: data.coordinator && data.coordinator.email != null ? data.coordinator.email : '',
      phone: data.coordinator && data.coordinator.phone != null ? data.coordinator.phone : '',
      contactFormUrl: data.coordinator && data.coordinator.contactFormUrl != null ? data.coordinator.contactFormUrl : ''
    };

    const blocks = (data.schedule && Array.isArray(data.schedule.blocks))
      ? data.schedule.blocks
      : (Array.isArray(data.blocks) ? data.blocks : []);
    this.schedule = {
      startDate: (data.schedule && data.schedule.startDate) || data.startDate || '',
      endDate: (data.schedule && data.schedule.endDate) || data.endDate || '',
      blocks: blocks.map(normalizeBlock)
    };

    this.price = {
      socio: data.price && data.price.socio != null ? data.price.socio : 0,
      nonSocio: data.price && data.price.nonSocio != null ? data.price.nonSocio : 0
    };
    this.capacity = {
      min: data.capacity && data.capacity.min != null ? data.capacity.min : 0,
      max: data.capacity && data.capacity.max != null ? data.capacity.max : 0
    };
    this.enrollmentDeadline = data.enrollmentDeadline || '';
    this.color = data.color || '#3B82F6';
    this.notes = data.notes || '';

    this.proposedBy = data.proposedBy || null;
    this.proposedAt = data.proposedAt || new Date();
    this.voteDeadline = data.voteDeadline || null;
    this.votes = Array.isArray(data.votes) ? data.votes : [];
    this.status = data.status || 'propuesto';
    this.publishedAt = data.publishedAt || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.updatedBy = data.updatedBy || null;
  }
}

module.exports = Course;

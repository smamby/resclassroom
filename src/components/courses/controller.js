const ROLES = require('../../../common/roles');
const Course = require('./models/Course');
const CourseStore = require('./store');
const BookingStore = require('../bookings/store');
const UserStore = require('../user/store');
const { expandRecurringDates, timesOverlap } = require('../../common/schedule');
const { computeVoteResult, VOTE_OPTIONS } = require('./voting');
const CoursesEmailService = require('./emailService');

// Umbral de aprobación y ventana de votación configurables por env. Se leen acá,
// al tope del controller, para que sean fáciles de cambiar.
const APPROVAL_RATIO = Number(process.env.COURSE_APPROVAL_RATIO || 0.75);
const VOTE_WINDOW_HOURS = Number(process.env.COURSE_VOTE_WINDOW_HOURS || 48);

// Estados visibles a cualquier persona (publicados y en curso/finalizado).
const PUBLIC_STATUSES = ['publicado', 'en_curso', 'finalizado'];
// Estados donde la grilla se puede ajustar sin re-votar (resolviendo conflictos).
const EDITABLE_AFTER_APPROVAL = ['aprobado', 'publicado', 'en_curso'];

function rolesOf(user) {
  return Array.isArray(user && user.role) ? user.role : [];
}

class CourseController {
  constructor() {
    this.store = new CourseStore();
    this.bookingStore = new BookingStore();
    this.userStore = new UserStore();
    this.email = new CoursesEmailService();
  }

  _voteUrl(courseId) {
    const base = process.env.APP_URL || 'http://localhost:3000';
    return `${base}/?votar=${String(courseId)}`;
  }

  _today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Visibilidad según rol: borradores solo dueño/admin; votaciones e histórico a
  // subco/admin; estados públicos a todos.
  _visibleTo(course, user) {
    const roles = rolesOf(user);
    if (roles.includes(ROLES.ADMIN)) return true;
    if (course.status === 'propuesto') {
      return !!user && String(course.proposedBy) === String(user.id);
    }
    if (PUBLIC_STATUSES.includes(course.status)) return true;
    if (roles.includes(ROLES.SUBCO)) return true;
    return !!user && String(course.proposedBy) === String(user.id);
  }

  _workspaceBlocks(course) {
    return (course.schedule && course.schedule.blocks || []).filter(b => b.workspaceId && !b.isPublicSpace);
  }

  // Genera el booking (soft) de un bloque con workspace. Los bloques de espacio
  // público (parque, etc.) no generan reserva: solo viven en el curso.
  _buildBooking(course, block) {
    return {
      workspaceId: block.workspaceId,
      startDate: course.schedule.startDate,
      endDate: course.schedule.endDate,
      startTime: block.startTime,
      endTime: block.endTime,
      userId: course.proposedBy,
      actividad: course.title,
      color: course.color || '#3B82F6',
      days: block.days,
      notes: course.notes || '',
      status: 'pending',
      courseId: String(course._id),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Chequea colisiones de los bloques de un curso contra reservas confirmadas y
  // soft bookings de otras propuestas. Devuelve lista de conflictos.
  async _checkConflicts(course, excludeCourseId) {
    const conflicts = [];
    for (const block of this._workspaceBlocks(course)) {
      const dateList = expandRecurringDates(course.schedule.startDate, course.schedule.endDate, block.days);
      const bookings = await this.bookingStore.findByWorkspaceAll(block.workspaceId);
      for (const eb of bookings) {
        if (excludeCourseId && eb.courseId && String(eb.courseId) === String(excludeCourseId)) continue;
        const ebDates = expandRecurringDates(eb.startDate || eb.date, eb.endDate || eb.date, eb.days);
        for (const date of dateList) {
          if (!ebDates.includes(date)) continue;
          if (timesOverlap(date, block.startTime, block.endTime, eb.startTime, eb.endTime)) {
            conflicts.push({ block: block.label, date, time: `${block.startTime} - ${block.endTime}`, workspaceId: block.workspaceId });
          }
        }
      }
    }
    return conflicts;
  }

  async _createSoftBookings(course) {
    for (const block of this._workspaceBlocks(course)) {
      await this.bookingStore.create(this._buildBooking(course, block));
    }
  }

  // Al ajustar la grilla de un curso publicado/aprobado/en curso se regeneran las
  // reservas confirmadas (soft-delete de las viejas + crear las nuevas).
  async _replaceConfirmedBookings(course) {
    await this.bookingStore.softDeleteByCourse(String(course._id));
    for (const block of this._workspaceBlocks(course)) {
      const booking = this._buildBooking(course, block);
      booking.status = 'confirmed';
      await this.bookingStore.create(booking);
    }
  }

  async _proposerEmail(course) {
    if (course.coordinator && course.coordinator.email) return course.coordinator.email;
    const user = await this.userStore.findById(course.proposedBy);
    return user && user.email ? user.email : null;
  }

  // Resuelve transiciones perezosas de un curso (fechas y votación) y las persiste.
  // Se llama al listar/detallar y al votar, así no hace falta un cron.
  async _resolveState(course) {
    const now = new Date();
    let status = course.status;
    let publishedAt = course.publishedAt;

    if (status === 'en_votacion') {
      const voters = await this.userStore.findByRole(ROLES.SUBCO);
      const res = computeVoteResult({
        votes: course.votes || [],
        voters: voters.map(v => v._id),
        deadline: course.voteDeadline,
        now: now.getTime(),
        approvalRatio: APPROVAL_RATIO
      });
      if (res.resolved) {
        if (res.approved) {
          status = 'publicado';
          publishedAt = publishedAt || now;
          await this.bookingStore.confirmPendingByCourse(String(course._id));
          this.email.sendApproved(await this._proposerEmail(course), course.title, 'Se generaron las reservas del curso en el calendario.');
        } else {
          status = 'rechazado';
          await this.bookingStore.softDeleteByCourse(String(course._id));
          this.email.sendRejected(await this._proposerEmail(course), course.title);
        }
        await this.store.update(String(course._id), { status, publishedAt, updatedAt: now });
        return { ...course, status, publishedAt };
      }
    }

    // Transiciones por fecha (lazy): publicado → en_curso → finalizado.
    const today = this._today();
    if ((status === 'publicado' || status === 'aprobado') && course.schedule && course.schedule.startDate && today >= course.schedule.startDate) {
      status = 'en_curso';
      await this.store.update(String(course._id), { status, updatedAt: now });
    } else if (status === 'en_curso' && course.schedule && course.schedule.endDate && today > course.schedule.endDate) {
      status = 'finalizado';
      await this.store.update(String(course._id), { status, updatedAt: now });
    }
    if (status !== course.status) return { ...course, status };
    return course;
  }

  async listCourses(req, res) {
    try {
      const all = await this.store.findAll();
      const visible = [];
      for (const c of all) {
        const rc = await this._resolveState(c);
        if (this._visibleTo(rc, req.user)) visible.push(rc);
      }
      res.status(200).json(visible);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getCourseById(req, res) {
    try {
      const course = await this.store.findById(req.params.id);
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      const rc = await this._resolveState(course);
      if (!this._visibleTo(rc, req.user)) return res.status(404).json({ error: 'Curso no encontrado' });
      res.status(200).json(rc);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createCourse(req, res) {
    try {
      const roles = rolesOf(req.user);
      if (!roles.includes(ROLES.INSTRUCTOR)) {
        return res.status(403).json({ error: 'Solo instructores pueden crear cursos' });
      }
      const course = new Course({ ...req.body, proposedBy: req.user.id });
      course.status = 'propuesto'; // arranca como borrador
      const result = await this.store.create(course);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateCourse(req, res) {
    try {
      const course = await this.store.findById(req.params.id);
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      const user = req.user;
      const roles = rolesOf(user);
      const isAdmin = roles.includes(ROLES.ADMIN);
      const isProposer = String(course.proposedBy) === String(user.id);
      if (!isAdmin && !isProposer) {
        return res.status(403).json({ error: 'No podés editar este curso' });
      }

      // Mezcla de los campos editables: las secciones anidadas se reemplazan completas.
      const merged = { ...course };
      for (const key of ['title', 'type', 'description', 'proposal', 'proposalUrl', 'color', 'notes', 'enrollmentDeadline']) {
        if (req.body[key] !== undefined) merged[key] = req.body[key];
      }
      if (req.body.coordinator) merged.coordinator = req.body.coordinator;
      if (req.body.price) merged.price = req.body.price;
      if (req.body.capacity) merged.capacity = req.body.capacity;
      if (req.body.schedule) merged.schedule = req.body.schedule;
      if (req.body.startDate !== undefined || req.body.endDate !== undefined) {
        merged.schedule = {
          ...(merged.schedule || {}),
          startDate: req.body.startDate !== undefined ? req.body.startDate : (merged.schedule && merged.schedule.startDate),
          endDate: req.body.endDate !== undefined ? req.body.endDate : (merged.schedule && merged.schedule.endDate)
        };
      }

      const model = new Course(merged);
      model._id = course._id; // el modelo no conserva _id: se restaura para linkear los soft bookings al curso
      const updates = { ...model, updatedAt: new Date(), updatedBy: user.id };
      delete updates._id;
      delete updates.createdAt;

      if (course.status === 'en_votacion') {
        // La nueva grilla no debe pisar otras reservas aunque estemos en votación:
        // al aprobar se confirman los pending sin re-validar, así que hay que
        // chequear colisiones acá antes de regenerar los soft bookings.
        const conflicts = await this._checkConflicts(model, String(course._id));
        if (conflicts.length > 0) {
          return res.status(409).json({ error: 'Hay colisiones en la nueva grilla', conflicts });
        }
        // Editar durante la votación reinicia votos y plazo: la SUBCO re-delibera.
        updates.votes = [];
        updates.voteDeadline = new Date(Date.now() + VOTE_WINDOW_HOURS * 3600 * 1000);
        await this.bookingStore.deletePendingByCourse(String(course._id));
        await this._createSoftBookings(model);
        const voters = await this.userStore.findByRole(ROLES.SUBCO);
        for (const v of voters) this.email.sendVoteRequest(v.email, model.title, this._voteUrl(course._id));
      } else if (EDITABLE_AFTER_APPROVAL.includes(course.status)) {
        // Ajuste de grilla post-aprobación: sin re-votar, pero re-chequeando colisiones.
        const conflicts = await this._checkConflicts(model, String(course._id));
        if (conflicts.length > 0) {
          return res.status(409).json({ error: 'Hay colisiones en la nueva grilla', conflicts });
        }
        await this._replaceConfirmedBookings(model);
      }

      const updated = await this.store.update(req.params.id, updates);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async submitCourse(req, res) {
    try {
      const course = await this.store.findById(req.params.id);
      if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
      const roles = rolesOf(req.user);
      const isAdmin = roles.includes(ROLES.ADMIN);
      if (course.status !== 'propuesto') {
        return res.status(400).json({ error: 'El curso no está en borrador' });
      }
      if (!isAdmin && String(course.proposedBy) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Solo el creador puede enviar el curso a votación' });
      }

      const model = new Course(course);
      model._id = course._id; // el modelo no conserva _id: se restaura para linkear los soft bookings al curso
      // Validaciones de envío: acá sí se exige la información completa.
      if (!model.title) return res.status(400).json({ error: 'Falta el nombre del curso' });
      if (!model.schedule.startDate || !model.schedule.endDate) {
        return res.status(400).json({ error: 'Faltan las fechas de inicio o fin' });
      }
      if (model.schedule.startDate > model.schedule.endDate) {
        return res.status(400).json({ error: 'La fecha de inicio debe ser anterior a la de fin' });
      }
      if (model.schedule.blocks.length === 0) {
        return res.status(400).json({ error: 'El curso necesita al menos un bloque de cursada' });
      }
      for (const b of model.schedule.blocks) {
        if (b.days.length === 0) return res.status(400).json({ error: 'Cada bloque necesita al menos un día de la semana' });
        if (!b.startTime || !b.endTime) return res.status(400).json({ error: 'Cada bloque necesita hora de inicio y fin' });
        if (b.startTime >= b.endTime) return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la de fin' });
      }
      if (this._workspaceBlocks(model).length === 0) {
        return res.status(400).json({ error: 'Se necesita al menos un bloque con un aula/espacio reservable' });
      }

      const conflicts = await this._checkConflicts(model);
      if (conflicts.length > 0) {
        return res.status(409).json({ error: 'El cronograma colisiona con otra reserva o propuesta', conflicts });
      }

      const voteDeadline = new Date(Date.now() + VOTE_WINDOW_HOURS * 3600 * 1000);
      await this.store.update(req.params.id, { status: 'en_votacion', voteDeadline, updatedAt: new Date(), updatedBy: req.user.id });
      await this._createSoftBookings(model);
      const voters = await this.userStore.findByRole(ROLES.SUBCO);
      for (const v of voters) this.email.sendVoteRequest(v.email, model.title, this._voteUrl(req.params.id));

      const updated = await this.store.findById(req.params.id);
      res.status(200).json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = CourseController;

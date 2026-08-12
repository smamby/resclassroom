(function (root) {
  // Helpers de API de /courses. Todos los fetch usan credentials 'include'.
  async function api(path, options) {
    const res = await fetch('/courses' + path, Object.assign({ credentials: 'include' }, options || {}));
    if (res.status === 401 && root.ResClassroomAuth && root.ResClassroomAuth.handleAuthError) {
      root.ResClassroomAuth.handleAuthError(res);
    }
    return res;
  }

  let workspaces = [];
  async function loadWorkspaces() {
    try {
      const res = await fetch('/workspaces', { credentials: 'include' });
      workspaces = res.ok ? await res.json() : [];
    } catch (e) {
      workspaces = [];
    }
    return workspaces;
  }

  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const STATUS_LABELS = {
    propuesto: 'Borrador', en_votacion: 'En votación', aprobado: 'Aprobado',
    rechazado: 'Rechazado', publicado: 'Publicado', en_curso: 'En curso',
    finalizado: 'Finalizado', cancelado: 'Cancelado', retirado: 'Retirado'
  };

  // ---------- Modal de curso (borrador) ----------

  function blockRow(block, idx) {
    const wsOptions = ['<option value="">— Seleccionar —</option>']
      .concat(workspaces.map(w => `<option value="${w._id}" ${block.workspaceId === String(w._id) ? 'selected' : ''}>${w.location ? w.name + ' (' + w.location + ')' : w.name}</option>`))
      .join('');
    const dayChecks = DAY_LABELS.map((label, d) => {
      const checked = (block.days || []).includes(d) ? 'checked' : '';
      return `<label class="day-checkbox"><input type="checkbox" name="block-days" value="${d}" ${checked}><span>${label}</span></label>`;
    }).join('');
    return `
      <div class="block-row" data-block-idx="${idx}">
        <div class="block-head">
          <span class="block-title">Bloque ${idx + 1}</span>
          <button type="button" class="block-remove" title="Quitar bloque">×</button>
        </div>
        <div class="block-grid">
          <div class="form-group">
            <label>Etiqueta (Teórica/Práctica)</label>
            <input type="text" class="block-label" value="${escapeHtml(block.label || '')}" placeholder="ej: Teórica">
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select class="block-kind">
              <option value="workspace" ${block.isPublicSpace ? '' : 'selected'}>Aula / espacio del club</option>
              <option value="public" ${block.isPublicSpace ? 'selected' : ''}>Espacio público (no se reserva)</option>
            </select>
          </div>
          <div class="form-group block-ws-group" ${block.isPublicSpace ? 'hidden' : ''}>
            <label>Aula / Espacio</label>
            <select class="block-workspace">${wsOptions}</select>
          </div>
          <div class="form-group block-public-group" ${block.isPublicSpace ? '' : 'hidden'}>
            <label>Nombre del espacio público</label>
            <input type="text" class="block-public-name" value="${escapeHtml(block.isPublicSpace ? block.workspaceName : '')}" placeholder="ej: Parque">
          </div>
          <div class="form-group-content-time">
            <div class="form-group">
              <label>Hora inicio</label>
              <input type="time" class="block-start" value="${block.startTime || '19:00'}">
            </div>
            <div class="form-group">
              <label>Hora fin</label>
              <input type="time" class="block-end" value="${block.endTime || '22:00'}">
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Días</label>
          <div class="days-selector">${dayChecks}</div>
        </div>
        <div class="block-conflict"></div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function openCourseModal(courseId) {
    loadWorkspaces().then(async () => {
      let course = {
        title: '', type: '', description: '', proposal: '', proposalUrl: '',
        coordinator: { name: '', email: '', phone: '', contactFormUrl: '' },
        schedule: { startDate: '', endDate: '', blocks: [{}] },
        price: { socio: '', nonSocio: '' }, capacity: { min: '', max: '' },
        enrollmentDeadline: '', color: '#3B82F6', notes: ''
      };
      if (courseId) {
        const res = await api('/' + courseId);
        if (res.ok) course = await res.json();
      }
      renderCourseModal(course, courseId);
    });
  }

  function renderCourseModal(course, courseId) {
    const existing = document.getElementById('courseModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'courseModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content modal-wide">
        <span class="modal-close" id="courseClose">&times;</span>
        <h2>${courseId ? 'Editar Curso' : 'Nuevo Curso'}</h2>
        <form id="courseForm">
          <div class="form-group">
            <label>Nombre del curso *</label>
            <input type="text" id="courseTitle" value="${escapeHtml(course.title)}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Tipo</label>
              <input type="text" id="courseType" value="${escapeHtml(course.type)}" placeholder="taller, capacitación...">
            </div>
            <div class="form-group">
              <label>Color</label>
              <input type="color" id="courseColor" value="${escapeHtml(course.color || '#3B82F6')}">
            </div>
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea id="courseDescription" rows="2">${escapeHtml(course.description)}</textarea>
          </div>
          <div class="form-group">
            <label>Propuesta (alcance, presupuesto, info del excel/pdf)</label>
            <textarea id="courseProposal" rows="5">${escapeHtml(course.proposal)}</textarea>
          </div>
          <div class="form-group">
            <label>Link al documento original (opcional)</label>
            <input type="url" id="courseProposalUrl" value="${escapeHtml(course.proposalUrl)}">
          </div>

          <h3>Coordinador</h3>
          <div class="form-row">
            <div class="form-group"><label>Nombre</label><input type="text" id="coordName" value="${escapeHtml(course.coordinator.name)}"></div>
            <div class="form-group"><label>Email</label><input type="email" id="coordEmail" value="${escapeHtml(course.coordinator.email)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Teléfono</label><input type="text" id="coordPhone" value="${escapeHtml(course.coordinator.phone)}"></div>
            <div class="form-group"><label>Formulario de contacto (link)</label><input type="url" id="coordFormUrl" value="${escapeHtml(course.coordinator.contactFormUrl)}"></div>
          </div>

          <h3>Inicio y fin de actividad</h3>
          <div class="form-row">
            <div class="form-group"><label>Fecha inicio</label><input type="date" id="courseStartDate" value="${escapeHtml(course.schedule.startDate)}"></div>
            <div class="form-group"><label>Fecha fin</label><input type="date" id="courseEndDate" value="${escapeHtml(course.schedule.endDate)}"></div>
          </div>

          <h3>Económico / Inscripción</h3>
          <div class="form-row">
            <div class="form-group"><label>Valor socio</label><input type="number" id="coursePriceSocio" value="${escapeHtml(course.price.socio)}" min="0"></div>
            <div class="form-group"><label>Valor no socio</label><input type="number" id="coursePriceNonSocio" value="${escapeHtml(course.price.nonSocio)}" min="0"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Cupo mínimo</label><input type="number" id="courseCupoMin" value="${escapeHtml(course.capacity.min)}" min="0"></div>
            <div class="form-group"><label>Cupo máximo</label><input type="number" id="courseCupoMax" value="${escapeHtml(course.capacity.max)}" min="0"></div>
            <div class="form-group"><label>Cierre de inscripción</label><input type="date" id="courseEnrollmentDeadline" value="${escapeHtml(course.enrollmentDeadline)}"></div>
          </div>
          <div class="form-group">
            <label>Comentarios / información adicional</label>
            <textarea id="courseNotes" rows="2">${escapeHtml(course.notes)}</textarea>
          </div>

          <h3>Grilla de cursada</h3>
          <div id="courseBlocks"></div>
          <button type="button" id="addBlock" class="btn-secondary">+ Agregar bloque</button>

          <div class="modal-actions">
            <button type="submit" id="saveDraft" class="btn-secondary">Guardar borrador</button>
            ${courseId ? '<button type="button" id="submitCourse" class="btn-primary">Enviar a votación</button>' : ''}
          </div>
        </form>
      </div>`;

    document.body.appendChild(modal);

    const blocksContainer = document.getElementById('courseBlocks');
    function renderBlocks() {
      blocksContainer.innerHTML = course.schedule.blocks.map(blockRow).join('');
      bindBlockEvents();
    }
    function bindBlockEvents() {
      blocksContainer.querySelectorAll('.block-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.block-row');
          const idx = parseInt(row.dataset.blockIdx, 10);
          course.schedule.blocks.splice(idx, 1);
          renderBlocks();
        });
      });
      blocksContainer.querySelectorAll('.block-kind').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const row = e.target.closest('.block-row');
          const isPublic = e.target.value === 'public';
          row.querySelector('.block-ws-group').hidden = isPublic;
          row.querySelector('.block-public-group').hidden = !isPublic;
        });
      });
      // Aviso de colisión en vivo al cambiar workspace/días/horarios.
      blocksContainer.querySelectorAll('.block-row').forEach(row => {
        row.querySelectorAll('select, input[type="time"], input[type="checkbox"]').forEach(el => {
          el.addEventListener('change', () => checkBlockConflicts(row));
        });
      });
    }
    renderBlocks();

    document.getElementById('addBlock').addEventListener('click', () => {
      course.schedule.blocks.push({});
      renderBlocks();
    });

    document.getElementById('courseClose').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Debounce del chequeo de colisiones por bloque.
    function checkBlockConflicts(row) {
      clearTimeout(row._conflictTimer);
      row._conflictTimer = setTimeout(async () => {
        const idx = parseInt(row.dataset.blockIdx, 10);
        const isPublic = row.querySelector('.block-kind').value === 'public';
        const workspaceId = row.querySelector('.block-workspace').value;
        const days = Array.from(row.querySelectorAll('input[name="block-days"]:checked')).map(cb => parseInt(cb.value, 10));
        const startTime = row.querySelector('.block-start').value;
        const endTime = row.querySelector('.block-end').value;
        const startDate = document.getElementById('courseStartDate').value;
        const endDate = document.getElementById('courseEndDate').value;
        const conflictEl = row.querySelector('.block-conflict');
        if (isPublic || !workspaceId || !startDate || !endDate || days.length === 0 || !startTime || !endTime) {
          conflictEl.textContent = '';
          return;
        }
        const qs = `workspaceId=${workspaceId}&startDate=${startDate}&endDate=${endDate}&days=${days.join(',')}&startTime=${startTime}&endTime=${endTime}&blockLabel=${encodeURIComponent(row.querySelector('.block-label').value || '')}`;
        const res = await api('/check-conflicts?' + qs);
        if (!res.ok) return;
        const data = await res.json();
        conflictEl.textContent = data.conflicts.length > 0
          ? '⚠ ' + data.conflicts.map(c => `${c.date} ${c.time}`).join(' | ')
          : '';
        conflictEl.classList.toggle('has-conflict', data.conflicts.length > 0);
      }, 350);
    }

    // Recolecta el formulario a un objeto de curso.
    function collectCourse() {
      const blocks = Array.from(document.querySelectorAll('#courseBlocks .block-row')).map(row => {
        const isPublic = row.querySelector('.block-kind').value === 'public';
        return {
          label: row.querySelector('.block-label').value,
          isPublicSpace: isPublic,
          workspaceId: isPublic ? null : row.querySelector('.block-workspace').value,
          workspaceName: isPublic ? row.querySelector('.block-public-name').value : '',
          location: isPublic ? '' : (function(){ const opt = row.querySelector('.block-workspace').selectedOptions[0]; return opt ? opt.textContent : ''; })(),
          days: Array.from(row.querySelectorAll('input[name="block-days"]:checked')).map(cb => parseInt(cb.value, 10)),
          startTime: row.querySelector('.block-start').value,
          endTime: row.querySelector('.block-end').value
        };
      });
      return {
        title: document.getElementById('courseTitle').value,
        type: document.getElementById('courseType').value,
        description: document.getElementById('courseDescription').value,
        proposal: document.getElementById('courseProposal').value,
        proposalUrl: document.getElementById('courseProposalUrl').value,
        coordinator: {
          name: document.getElementById('coordName').value,
          email: document.getElementById('coordEmail').value,
          phone: document.getElementById('coordPhone').value,
          contactFormUrl: document.getElementById('coordFormUrl').value
        },
        schedule: {
          startDate: document.getElementById('courseStartDate').value,
          endDate: document.getElementById('courseEndDate').value,
          blocks
        },
        price: { socio: document.getElementById('coursePriceSocio').value, nonSocio: document.getElementById('coursePriceNonSocio').value },
        capacity: { min: document.getElementById('courseCupoMin').value, max: document.getElementById('courseCupoMax').value },
        enrollmentDeadline: document.getElementById('courseEnrollmentDeadline').value,
        color: document.getElementById('courseColor').value,
        notes: document.getElementById('courseNotes').value
      };
    }

    document.getElementById('courseForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = collectCourse();
      const res = courseId
        ? await api('/' + courseId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await api('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        root.aviso('Borrador guardado');
        modal.remove();
        if (root.ResClassroomRefresh) root.ResClassroomRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        root.aviso('Error: ' + (data.error || 'No se pudo guardar'));
      }
    });

    const submitBtn = document.getElementById('submitCourse');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const payload = collectCourse();
        const res = await api('/' + courseId + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) {
          root.aviso('Enviado a votación');
          modal.remove();
          if (root.ResClassroomRefresh) root.ResClassroomRefresh();
        } else {
          const data = await res.json().catch(() => ({}));
          if (data.conflicts && data.conflicts.length) {
            root.aviso('Colisión: ' + data.conflicts.map(c => `${c.date} ${c.time}`).join(' | '));
          } else {
            root.aviso('Error: ' + (data.error || 'No se pudo enviar'));
          }
        }
      });
    }
  }

  // ---------- Vista "Cursos" ----------

  function courseCard(c) {
    const canEdit = c.proposedBy === sessionStorage.getItem('userId');
    const roles = JSON.parse(sessionStorage.getItem('roles') || '[]');
    const isAdmin = roles.includes('admin');
    const isSubco = roles.includes('subco');
    const actions = [];
    if (c.status === 'propuesto' && (canEdit || isAdmin)) {
      actions.push(`<button class="btn-secondary" onclick="ResClassroomCourses.editCourse('${c._id}')">Editar</button>`);
      actions.push(`<button class="btn-secondary" onclick="ResClassroomCourses.deleteCourse('${c._id}')">Borrar</button>`);
      actions.push(`<button class="btn-primary" onclick="ResClassroomCourses.submitCourse('${c._id}')">Enviar a votación</button>`);
    }
    if ((c.status === 'rechazado' || c.status === 'retirado') && (canEdit || isAdmin)) {
      actions.push(`<button class="btn-secondary" onclick="ResClassroomCourses.backToDraft('${c._id}')">Volver a borrador</button>`);
    }
    if ((c.status === 'publicado' || c.status === 'en_curso') && (canEdit || isAdmin)) {
      actions.push(`<button class="btn-secondary" onclick="ResClassroomCourses.cancelCourse('${c._id}')">Cancelar</button>`);
    }
    const scheduleSummary = (c.schedule && c.schedule.blocks || []).map(b =>
      `${b.label ? b.label + ': ' : ''}${b.isPublicSpace ? b.workspaceName || 'Espacio público' : b.workspaceName || ''} ${b.days.map(d => DAY_LABELS[d]).join('/')} ${b.startTime}-${b.endTime}`
    ).join('<br>');
    return `
      <div class="course-card" style="border-left-color: ${c.color || '#999'}">
        <div class="course-card-head">
          <span class="course-status status-${c.status}">${STATUS_LABELS[c.status] || c.status}</span>
          <h3>${escapeHtml(c.title)}</h3>
        </div>
        ${c.type ? `<div class="course-meta">${escapeHtml(c.type)}</div>` : ''}
        ${(c.schedule && c.schedule.startDate) ? `<div class="course-meta">${c.schedule.startDate} → ${c.schedule.endDate}</div>` : ''}
        <div class="course-schedule">${scheduleSummary}</div>
        ${actions.length ? `<div class="course-actions">${actions.join(' ')}</div>` : ''}
      </div>`;
  }

  async function openCursosView() {
    const existing = document.getElementById('cursosView');
    if (existing) existing.remove();
    const res = await api('/');
    if (!res.ok) return root.aviso('No se pudieron cargar los cursos');
    const courses = await res.json();

    const overlay = document.createElement('div');
    overlay.id = 'cursosView';
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="overlay-content">
        <div class="overlay-head">
          <h2>Cursos</h2>
          <button class="btn-secondary" onclick="ResClassroomCourses.closeView('cursosView')">Cerrar</button>
        </div>
        <div class="overlay-tabs">
          <button class="tab active" data-tab="borradores">Mis borradores</button>
          <button class="tab" data-tab="votacion">En votación</button>
          <button class="tab" data-tab="publicados">Publicados</button>
          <button class="tab" data-tab="historico">Histórico</button>
        </div>
        <div id="cursosList" class="course-list"></div>
      </div>`;
    document.body.appendChild(overlay);

    const listEl = document.getElementById('cursosList');
    function renderTab(tab) {
      let filtered = [];
      if (tab === 'borradores') filtered = courses.filter(c => c.status === 'propuesto');
      if (tab === 'votacion') filtered = courses.filter(c => c.status === 'en_votacion');
      if (tab === 'publicados') filtered = courses.filter(c => ['publicado', 'en_curso', 'finalizado'].includes(c.status));
      if (tab === 'historico') filtered = courses.filter(c => ['rechazado', 'retirado', 'cancelado'].includes(c.status));
      listEl.innerHTML = filtered.length
        ? filtered.map(courseCard).join('')
        : '<p class="empty">Sin cursos en esta categoría</p>';
    }

    overlay.querySelectorAll('.tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        overlay.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tabBtn.classList.add('active');
        renderTab(tabBtn.dataset.tab);
      });
    });
    renderTab('borradores');
  }

  // Acciones de cards (exposed para onclick inline).
  async function editCourse(id) { openCourseModal(id); }
  async function deleteCourse(id) {
    if (!root.confirmar || await root.confirmar('¿Borrar este borrador?')) {
      const res = await api('/' + id, { method: 'DELETE' });
      if (res.ok) { root.aviso('Borrador eliminado'); openCursosView(); } else root.aviso('No se pudo borrar');
    }
  }
  async function submitCourse(id) {
    const res = await api('/' + id + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    if (res.ok) { root.aviso('Enviado a votación'); openCursosView(); } else root.aviso('No se pudo enviar');
  }
  async function backToDraft(id) {
    const res = await api('/' + id + '/back-to-draft', { method: 'POST' });
    if (res.ok) { root.aviso('Vuelto a borrador'); openCursosView(); } else root.aviso('No se pudo volver a borrador');
  }
  async function cancelCourse(id) {
    if (root.confirmar && !(await root.confirmar('¿Cancelar el curso y liberar sus reservas?'))) return;
    const res = await api('/' + id + '/cancel', { method: 'POST' });
    if (res.ok) { root.aviso('Curso cancelado'); openCursosView(); } else root.aviso('No se pudo cancelar');
  }
  function closeView(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  root.ResClassroomCourses = { openCourseModal, openCursosView, editCourse, deleteCourse, submitCourse, backToDraft, cancelCourse, closeView };
})(typeof self !== 'undefined' ? self : this);

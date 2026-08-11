(function (root) {
  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  function getBadgeEl() {
    return document.querySelector('[data-vote-badge]');
  }

  // Badge de votaciones pendientes (se llama tras login y en cada watchdog).
  function updateVoteBadge() {
    const badge = getBadgeEl();
    if (!badge) return;
    const roles = JSON.parse(sessionStorage.getItem('roles') || '[]');
    if (!roles.includes(root.ROLES.SUBCO)) { badge.hidden = true; return; }
    fetch('/courses/pending-count', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const count = (data && typeof data.count === 'number') ? data.count : 0;
        badge.textContent = String(count);
        badge.hidden = count === 0;
      })
      .catch(() => { badge.hidden = true; });
  }

  function voteLabel(v) {
    return v === 'positive' ? 'A favor' : v === 'negative' ? 'En contra' : 'Abstención';
  }

  // Renderiza una propuesta en votación con detalle, conteo parcial y botones.
  function votingCard(course) {
    const roles = JSON.parse(sessionStorage.getItem('roles') || '[]');
    if (!roles.includes(root.ROLES.SUBCO)) return '';
    const userId = sessionStorage.getItem('userId');
    const myVote = (course.votes || []).find(v => String(v.userId) === String(userId));
    const positives = (course.votes || []).filter(v => v.vote === 'positive').length;
    const negatives = (course.votes || []).filter(v => v.vote === 'negative').length;
    const abstains = (course.votes || []).filter(v => v.vote === 'abstain').length;
    const votedCount = (course.votes || []).length;

    const deadline = course.voteDeadline ? new Date(course.voteDeadline) : null;
    const remaining = deadline ? Math.max(0, deadline.getTime() - Date.now()) : 0;
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);

    const schedule = (course.schedule.blocks || []).map(b =>
      `<li>${b.label ? b.label + ': ' : ''}${b.isPublicSpace ? b.workspaceName || 'Espacio público' : b.workspaceName || ''} — ${b.days.map(d => DAY_LABELS[d]).join('/')} ${b.startTime}-${b.endTime}</li>`
    ).join('');

    return `
      <div class="course-card" style="border-left-color: ${course.color || '#999'}">
        <h3>${course.title}</h3>
        <div class="course-meta">${course.type || ''} · ${course.schedule.startDate} → ${course.schedule.endDate}</div>
        ${course.proposal ? `<div class="course-proposal">${course.proposal}</div>` : ''}
        <ul class="course-schedule">${schedule}</ul>
        <div class="course-meta">Votos: ${votedCount}/${(course.votes || []).length} · A favor ${positives} · En contra ${negatives} · Abstención ${abstains}</div>
        <div class="course-meta">Cierra en ${hours}h ${minutes}m</div>
        ${myVote ? `<div class="course-meta">Tu voto: ${voteLabel(myVote.vote)}</div>` : ''}
        <div class="vote-actions">
          <button class="btn-primary" onclick="ResClassroomVoting.vote('${course._id}', 'positive')">A favor</button>
          <button class="btn-secondary" onclick="ResClassroomVoting.vote('${course._id}', 'negative')">En contra</button>
          <button class="btn-secondary" onclick="ResClassroomVoting.vote('${course._id}', 'abstain')">Abstenerse</button>
        </div>
      </div>`;
  }

  async function openVotarView() {
    const existing = document.getElementById('votarView');
    if (existing) existing.remove();
    const res = await fetch('/courses', { credentials: 'include' });
    if (!res.ok) return root.aviso('No se pudieron cargar las votaciones');
    const courses = await res.json();
    const pending = courses.filter(c => c.status === 'en_votacion');

    const overlay = document.createElement('div');
    overlay.id = 'votarView';
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="overlay-content">
        <div class="overlay-head">
          <h2>Votar (SUBCO)</h2>
          <button class="btn-secondary" onclick="ResClassroomVoting.close()">Cerrar</button>
        </div>
        <div id="votarList" class="course-list">
          ${pending.length ? pending.map(votingCard).join('') : '<p class="empty">No hay votaciones abiertas</p>'}
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  async function vote(courseId, vote) {
    const res = await fetch('/courses/' + courseId + '/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ vote })
    });
    if (res.status === 401 && root.ResClassroomAuth && root.ResClassroomAuth.handleAuthError) {
      root.ResClassroomAuth.handleAuthError(res);
      return;
    }
    if (res.ok) {
      root.aviso('Voto registrado');
      updateVoteBadge();
      openVotarView();
    } else {
      const data = await res.json().catch(() => ({}));
      root.aviso('Error: ' + (data.error || 'No se pudo votar'));
    }
  }

  function close() {
    const el = document.getElementById('votarView');
    if (el) el.remove();
  }

  // Deep-link desde el email: /?votar=<courseId> abre la vista de votación.
  function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('votar')) {
      setTimeout(openVotarView, 500);
    }
  }

  // Guard de entorno: sin DOM (Node) el deep-link no aplica; evita un throw al requerir el archivo.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handleDeepLink);
    } else {
      handleDeepLink();
    }
  }

  root.ResClassroomVoting = { updateVoteBadge, openVotarView, vote, close };
})(typeof self !== 'undefined' ? self : this);

// Badge de votaciones pendientes para miembros SUBCO.
// Se expone como window.ResClassroomVoting para que app.js lo actualice tras
// login y en cada tick del watchdog (/auth/me cada 60s).
(function (root) {
  function getBadgeEl() {
    return document.querySelector('[data-vote-badge]');
  }

  function updateVoteBadge() {
    const badge = getBadgeEl();
    if (!badge) return;
    const rolesJson = sessionStorage.getItem('roles');
    const roles = rolesJson ? JSON.parse(rolesJson) : [];
    if (!roles.includes(root.ROLES.SUBCO)) {
      badge.hidden = true;
      return;
    }
    fetch('/courses/pending-count', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const count = (data && typeof data.count === 'number') ? data.count : 0;
        badge.textContent = String(count);
        badge.hidden = count === 0;
      })
      .catch(() => { badge.hidden = true; });
  }

  root.ResClassroomVoting = { updateVoteBadge };
})(typeof self !== 'undefined' ? self : this);

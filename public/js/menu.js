(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ResClassroomMenu = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const MENU_ITEMS = {
    'mi-cuenta': { label: 'Mi cuenta' },
    'mis-reservas': { label: 'Mis Reservas' },
    'gestionar-espacios': { label: 'Gestionar Espacios' },
    'gestionar-usuarios': { label: 'Gestionar Usuarios' },
    'votar': { label: 'Votar' },
    'cursos': { label: 'Cursos' },
    'logout': { label: 'Cerrar Sesión' }
  };

  const MENU_CONFIG = {
    base: ['mi-cuenta', 'logout'],
    admin: ['gestionar-usuarios', 'gestionar-espacios', 'mis-reservas'],
    instructor: ['mis-reservas'],
    subco: ['votar', 'cursos']
  };

  // Unión de base + extras por rol, sin duplicados. El orden de claves de
  // MENU_CONFIG define el orden de los extras; logout queda al final.
  function buildMenuItems(roles) {
    const selected = Array.isArray(roles) ? roles : [];
    const items = MENU_CONFIG.base.slice();
    const extras = [];
    Object.keys(MENU_CONFIG).forEach((role) => {
      if (role === 'base') return;
      if (!selected.includes(role)) return;
      MENU_CONFIG[role].forEach((id) => {
        if (!extras.includes(id)) extras.push(id);
      });
    });
    items.splice(items.length - 1, 0, ...extras.filter((id) => !items.includes(id)));
    return items;
  }

  const ICON_DOTS = `<svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6C12.5523 6 13 5.55228 13 5Z" stroke="#eee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12Z" stroke="#eee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19Z" stroke="#eee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const ICON_HAMBURGER = `<svg width="20px" height="20px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6H20M4 12H20M4 18H20" stroke="#eee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  let handlers = {};
  let containerEl = null;

  function openMenu(menuEl) {
    const dropdown = menuEl.querySelector('.menu-dropdown');
    const btn = menuEl.querySelector('.menu-btn');
    if (dropdown) dropdown.hidden = false;
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu(menuEl) {
    const dropdown = menuEl.querySelector('.menu-dropdown');
    const btn = menuEl.querySelector('.menu-btn');
    if (dropdown) dropdown.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu(menuEl) {
    const dropdown = menuEl.querySelector('.menu-dropdown');
    if (dropdown && dropdown.hidden) openMenu(menuEl);
    else closeMenu(menuEl);
  }

  function buildMarkup(items) {
    const svg = window.innerWidth < 480 ? ICON_DOTS : ICON_HAMBURGER;
    const list = items.map((id) => {
      const item = MENU_ITEMS[id];
      if (!item) return '';
      const sep = id === 'logout' ? '<li class="menu-separator" role="separator"></li>' : '';
      return `${sep}<li><button type="button" class="menu-item" data-action="${id}">${item.label}</button></li>`;
    }).join('');
    return `
      <button type="button" class="menu-btn" aria-haspopup="true" aria-expanded="false" aria-label="menu de usuario" title="Usuario">${svg}</button>
      <ul class="menu-dropdown" hidden>${list}</ul>
    `;
  }

  function wireEvents(menuEl) {
    const btn = menuEl.querySelector('.menu-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(menuEl);
      });
    }
    menuEl.querySelectorAll('.menu-item').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        closeMenu(menuEl);
        const action = itemBtn.dataset.action;
        if (handlers[action]) handlers[action]();
      });
    });
  }

  // Renderiza el botón y el dropdown según el estado de sesión.
  // Los items sin handler (placeholders) no hacen nada al click.
  function render({ loggedIn }) {
    containerEl = document.getElementById('menu');
    if (!containerEl) return;
    if (!loggedIn) {
      containerEl.innerHTML = '';
      containerEl.hidden = true;
      containerEl.style.display = 'none';
      return;
    }
    const rolesJson = sessionStorage.getItem('roles');
    const roles = rolesJson ? JSON.parse(rolesJson) : [];
    containerEl.innerHTML = buildMarkup(buildMenuItems(roles));
    containerEl.hidden = false;
    containerEl.style.display = 'flex';
    wireEvents(containerEl);
  }

  function init(options) {
    handlers = options || {};
    document.addEventListener('click', (e) => {
      if (containerEl && !containerEl.contains(e.target)) closeMenu(containerEl);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && containerEl) closeMenu(containerEl);
    });
  }

  return { MENU_ITEMS, MENU_CONFIG, buildMenuItems, init, render };
});

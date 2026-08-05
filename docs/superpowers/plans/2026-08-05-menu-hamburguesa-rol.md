# Menú hamburguesa por rol — Plan de implementación

> **Para agentes:** REQUIRED SUB-SKILL: usar `subagent-driven-development` o `executing-plans`. Pasos con checkbox (`- [ ]`).

**Goal:** Menú dropdown en el navbar visible solo logueado, con items según rol (base: Mi cuenta, Cerrar Sesión; admin suma Gestionar Usuarios/Espacios/Mis Reservas; instructor suma Mis Reservas; subco suma Votar/Cursos).

**Architecture:** Enfoque A — config declarativa. Módulo `public/js/menu.js` UMD (browser + Jest) con `MENU_ITEMS`, `MENU_CONFIG`, `buildMenuItems` (pura) y renderizado DOM en `render`/`init`. `app.js` solo delega en `render({ loggedIn })`.

**Tech Stack:** JS vanilla, HTML/CSS, Jest (`pnpm test`).

---

## Estructura de archivos

- Crear: `public/js/menu.js` — config + lógica pura + DOM (una responsabilidad: menú).
- Crear: `public/js/__tests__/menu.test.js` — tests de `buildMenuItems`.
- Modificar: `public/index.html` — script tag.
- Modificar: `public/js/app.js` — `renderAuthUI` (líneas 140-194) y registro de handlers (línea ~975).
- Modificar: `public/css/styles.css` — estilos del dropdown.

## Task 1: `buildMenuItems` (TDD)

**Files:**
- Create: `public/js/__tests__/menu.test.js`
- Create: `public/js/menu.js`

- [ ] **Step 1: escribir el test (falla: módulo no existe)**

```js
const { buildMenuItems } = require('../menu');

describe('buildMenuItems', () => {
  test('visitor ve solo items base', () => {
    expect(buildMenuItems(['visitor'])).toEqual(['mi-cuenta', 'logout']);
  });
  test('sin roles ve solo items base', () => {
    expect(buildMenuItems()).toEqual(['mi-cuenta', 'logout']);
    expect(buildMenuItems([])).toEqual(['mi-cuenta', 'logout']);
  });
  test('rol desconocido ve solo items base', () => {
    expect(buildMenuItems(['pirata'])).toEqual(['mi-cuenta', 'logout']);
  });
  test('instructor ve base + mis reservas', () => {
    expect(buildMenuItems(['instructor'])).toEqual(['mi-cuenta', 'mis-reservas', 'logout']);
  });
  test('admin ve base + gestion y mis reservas', () => {
    expect(buildMenuItems(['admin'])).toEqual(['mi-cuenta', 'gestionar-usuarios', 'gestionar-espacios', 'mis-reservas', 'logout']);
  });
  test('subco ve base + votar y cursos', () => {
    expect(buildMenuItems(['subco'])).toEqual(['mi-cuenta', 'votar', 'cursos', 'logout']);
  });
  test('multi-rol (admin + instructor) sin duplicados', () => {
    expect(buildMenuItems(['admin', 'instructor'])).toEqual(['mi-cuenta', 'gestionar-usuarios', 'gestionar-espacios', 'mis-reservas', 'logout']);
  });
});
```

- [ ] **Step 2: correr y ver fallar**

Run: `pnpm test -- public/js/__tests__/menu.test.js`
Expected: FAIL — "Cannot find module '../menu'"

- [ ] **Step 3: crear `public/js/menu.js`** (UMD completo)

```js
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
```

- [ ] **Step 4: correr y ver pasar**

Run: `pnpm test -- public/js/__tests__/menu.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: commit**

```
git add public/js/menu.js public/js/__tests__/menu.test.js
git commit -m "feat: modulo de menu con items segun rol"
```

## Task 2: Integrar en `index.html` y `app.js`

**Files:**
- Modify: `public/index.html:165`
- Modify: `public/js/app.js:140-194`
- Modify: `public/js/app.js:~975`

- [ ] **Step 1: script tag**

En `index.html`, antes de `<script src="/js/app.js"></script>`:

```html
<script src="/js/menu.js"></script>
```

- [ ] **Step 2: reemplazar bloque de menú en `renderAuthUI`**

En `app.js` `renderAuthUI`, eliminar `const menu = document.getElementById('menu');` y `menu.style.display = "none";` (líneas 145-146), el bloque `if (menu) { menu.style.display = "flex"; ... menu.innerHTML = ... }` (166-183) y `if (menu) { menu.hidden = true; menu.innerHTML = ''; }` (191). Agregar al final de `renderAuthUI`:

```js
      if (window.ResClassroomMenu) {
        window.ResClassroomMenu.render({ loggedIn });
      }
```

- [ ] **Step 3: registrar handlers al inicio**

Después de la definición de `handleAuthError` (línea ~975):

```js
    // El menú delega la accion de logout al flujo existente de sesion
    if (window.ResClassroomMenu) {
      window.ResClassroomMenu.init({ logout });
    }
```

- [ ] **Step 4: verificar que nada se rompió**

Run: `pnpm test`
Expected: PASS (36 existentes + 7 nuevos)

- [ ] **Step 5: commit**

```
git add public/index.html public/js/app.js
git commit -m "feat: integrar menu por rol en navbar"
```

## Task 3: Estilos del dropdown

**Files:**
- Modify: `public/css/styles.css:281-296`

- [ ] **Step 1: reemplazar reglas `.menu`/`.menu:hover` por:**

```css
/* menu in navbar (shown only when logged in) */
.menu {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    margin-left: 0.5rem;
    cursor: pointer;
    transition: transform var(--transition-fast);
    position: relative;
}
.menu-btn {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #eee;
    cursor: pointer;
    padding: 0;
    transition: transform var(--transition-fast);
}
.menu-btn:hover {
    transform: translateY(-1px) scale(1.2);
}
.menu-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 10px);
    min-width: 200px;
    list-style: none;
    padding: 0.5rem;
    margin: 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--card-shadow);
    z-index: 1000;
}
.menu-dropdown[hidden] {
    display: none;
}
.menu-item {
    width: 100%;
    text-align: left;
    padding: 0.6rem 0.9rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
}
.menu-item:hover {
    background: var(--bg-card);
}
.menu-separator {
    height: 1px;
    background: var(--border-subtle);
    margin: 0.4rem 0.6rem;
}
```

- [ ] **Step 2: commit**

```
git add public/css/styles.css
git commit -m "style: estilos del dropdown del menu de usuario"
```

## Task 4: Verificación manual (smoke test)

- [ ] **Step 1:** `pnpm dev`, abrir navegador: deslogueado → sin botón menú.
- [ ] **Step 2:** login admin → menú con Mi cuenta, Gestionar Usuarios, Gestionar Espacios, Mis Reservas, separador, Cerrar Sesión. Click fuera / Esc cierran. "Cerrar Sesión" desloguea.
- [ ] **Step 3:** login instructor → Mi cuenta, Mis Reservas, Cerrar Sesión. Visitor → Mi cuenta, Cerrar Sesión.
- [ ] **Step 4:** verificar en móvil (<480px) el icono de 3 puntos y el dropdown alineado a la derecha.

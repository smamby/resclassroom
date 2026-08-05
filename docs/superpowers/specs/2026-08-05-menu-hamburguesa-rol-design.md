# Diseño: Menú hamburguesa responsivo al rol del usuario

Fecha: 2026-08-05
Estado: Aprobado

## Contexto

El navbar ya muestra un botón hamburguesa (`#menu`) solo cuando el usuario está logueado, pero no abre ningún dropdown. Este feature agrega el dropdown con opciones que varían según el rol del usuario logueado.

Las acciones del menú (Mi cuenta, Gestionar Usuarios, Votar, Cursos, etc.) son features en sí mismas y **no se desarrollan en este feature**. Aquí solo se construye el menú que renderiza los items según rol. Los items sin UI desarrollada actúan como placeholders sin acción; solo `logout` funciona.

## Matriz de items del menú

| id | Label | Roles |
|----|-------|-------|
| `mi-cuenta` | Mi cuenta | Todos (base) |
| `mis-reservas` | Mis Reservas | admin, instructor |
| `gestionar-espacios` | Gestionar Espacios | admin |
| `gestionar-usuarios` | Gestionar Usuarios | admin |
| `votar` | Votar | subco |
| `cursos` | Cursos | subco |
| `logout` | Cerrar Sesión | Todos (base) |

Orden en el dropdown: items base primero (Mi cuenta, Cerrar Sesión) y los extras de cada rol intercalados entre ellos, con un separador visual antes de Cerrar Sesión.

Roles actuales en el backend: `admin`, `instructor`, `visitor`, `subco` (`src/components/user/models/User.js`).

Decisiones tomadas durante el brainstorming:

- **Instructor = opciones por defecto** (solo base, más `mis-reservas`).
- **"Promover" se renombra a "Gestionar Usuarios"** para admin, ya que contempla promover, anular y editar roles.
- **"Cambiar Contraseña" forma parte de la feature "Mi cuenta"** (no es item propio).
- **"Mis Reservas" solo para instructor y admin**, nunca para visitor.
- Se mantiene el botón rojo "Cerrar Sesión" del navbar además del logout dentro del menú.
- El botón hamburguesa mantiene su comportamiento actual de icono: hamburguesa en desktop, tres puntos en móvil (< 480px).

## Arquitectura

Enfoque A: config declarativa en frontend.

Nuevo módulo `public/js/menu.js` (patrón UMD: funciona en el navegador y exporta `module.exports` para Jest):

- `MENU_ITEMS`: registro `id -> { label }`.
- `MENU_CONFIG`: mapea rol a lista de items, con clave `base` que siempre aplica.
- `buildMenuItems(roles)`: función pura y testeable. Devuelve base + extras de cada rol presente, en orden de inserción de claves de `MENU_CONFIG`, sin duplicados. Roles desconocidos o ausencia de roles → solo base.
- `init({ logout })` y `render()`: construyen el botón y el dropdown, manejan toggle/cierre de click fuera y tecla Esc, y registran handlers. Solo tocan el DOM al ser invocadas (requisito para importar el módulo en Jest).

`MENU_CONFIG` (orden de claves define el orden de extras):

```js
const MENU_CONFIG = {
  base: ['mi-cuenta', 'logout'],
  admin: ['gestionar-usuarios', 'gestionar-espacios', 'mis-reservas'],
  instructor: ['mis-reservas'],
  subco: ['votar', 'cursos']
};
```

### Integración con el frontend existente

- `public/index.html`: agregar `<script src="/js/menu.js">` antes de `app.js`.
- `public/js/app.js`:
  - En `renderAuthUI` se reemplaza el armado inline del SVG por la llamada a `render()` del módulo (que ya respeta el breakpoint móvil).
  - `app.js` registra una vez `init({ logout })`; el item `logout` invoca la función `logout()` existente.
  - Los items no implementados (`mi-cuenta`, `gestionar-usuarios`, `gestionar-espacios`, `mis-reservas`, `votar`, `cursos`) son placeholders sin acción al click.
  - El botón "Cerrar Sesión" del navbar se conserva sin cambios.
- `public/css/styles.css`: estilos del dropdown (posicionado absoluto alineado a la derecha bajo el botón, `z-index` alto, estados hover, separador antes de logout).

## Comportamiento del dropdown

- Toggle al click sobre el botón.
- Se cierra al: click fuera del menú, tecla Esc, clickear un item.
- Al loguear/desloguear/expirar sesión, `renderAuthUI` re-renderiza el menú (y lo oculta si no hay sesión).
- Accesibilidad: `aria-haspopup` y `aria-expanded` en el botón.

## Seguridad

El menú es **solo presentación y nunca es frontera de seguridad**. Los roles en `sessionStorage` son manipulables desde el navegador; por eso cada acción, cuando se desarrolle, debe validar autorización en el backend (patrón ya existente: `auth.authenticate`, `auth.authenticateAdmin`, chequeos de rol en controladores). Manipular `sessionStorage` solo cambia lo que se muestra en la UI.

## Edge cases

- Multi-rol (ej: admin + instructor) → unión sin duplicados.
- Sin roles en `sessionStorage` o rol desconocido → solo base.
- Sesión expira con el dropdown abierto → se cierra al re-renderizar.

## Testing

Nuevo archivo `public/js/__tests__/menu.test.js` (Jest, lo toma `pnpm test` con el testMatch por defecto). Se testea `buildMenuItems`:

- visitor → `['mi-cuenta', 'logout']`
- instructor → `['mi-cuenta', 'mis-reservas', 'logout']`
- admin → `['mi-cuenta', 'gestionar-usuarios', 'gestionar-espacios', 'mis-reservas', 'logout']`
- multi-rol (admin + instructor) → sin duplicados
- subco → `['mi-cuenta', 'votar', 'cursos', 'logout']`
- rol desconocido → solo base
- sin roles → solo base

## Archivos afectados

- Crear: `public/js/menu.js`
- Crear: `public/js/__tests__/menu.test.js`
- Modificar: `public/index.html`
- Modificar: `public/js/app.js`
- Modificar: `public/css/styles.css`

# TokenVersion (logout) — Review, Fixes, Tests & Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revisar y completar el fix de seguridad de logout por `tokenVersion`, reparar los 8 tests rojos, agregar cobertura de la nueva invalidación y actualizar documentación/requerimientos.

**Architecture:** El commit `df90f35` agregó claim `tv` (tokenVersion) al JWT: logout incrementa `tokenVersion` en DB y el middleware `checkPasswordAndTokenVersion` lo revalida junto a `pwdv`. La causa raíz de los tests rojos es un secret JWT divergente: el middleware usa `'harito ama la playa'` como fallback mientras controllers/tests usan `'change-me-please'`. Se centraliza el secret en un módulo compartido, se fixean bugs colaterales (`Console.error`, `tv` faltante en re-issue de cambio de contraseña), se limpia debug/dead code, se alinea el `clearCookie` del logout y se documenta.

**Tech Stack:** Node.js/Express, MongoDB, Jest (`pnpm.cmd jest --forceExit`), JWT (jsonwebtoken).

---

## Hallazgos de la revisión (contexto)

1. 🔴 Secret JWT divergido → causa de los 8 tests rojos + bug latente en prod si faltara `JWT_SECRET`.
2. 🔴 `public/js/app.js:922` — `Console.error` (C mayúscula) → `ReferenceError` en el catch de logout.
3. 🔴 `src/components/user/controller.js:72-74` — `changeMyPassword` re-emite el token sin claim `tv` → sesión muerta al instante si `tokenVersion` de DB ≥ 1.
4. 🟡 Logs de debug por request en el middleware.
5. 🟡 Código muerto comentado (logout viejo, chequeo viejo).
6. 🟡 `UserModel` importado sin usar en `user/store.js`.
7. 🟡 `clearCookie` del logout no espejea las opciones del set (dev: `sameSite:'none'`+`secure:true` vs login `lax` sin secure); y pasar `maxAge` a `clearCookie` hace que Express re-setee la cookie 20 min en vez de borrarla.

---

### Task 1: Secret JWT centralizado (repara los 8 tests + bug latente)

**Files:**
- Create: `common/jwtSecret.js`
- Modify: `src/middleware/authMiddleware.js:5`
- Modify: `src/components/auth/controller.js:7`
- Modify: `src/components/user/controller.js:11`
- Modify: `src/middleware/__tests__/authMiddleware.test.js:8`
- Modify: `src/components/auth/__tests__/auth.controller.test.js:53`

- [x] **Step 1: Crear el módulo compartido**

```js
// common/jwtSecret.js
// Secret JWT en un solo lugar: middleware, controllers y tests comparten el
// mismo valor aunque falte JWT_SECRET (si no, login firma con un secret y el
// middleware verifica con otro).
module.exports = process.env.JWT_SECRET || 'harito ama la playa';
```

- [x] **Step 2: Reemplazar el fallback en los 5 archivos**

| Archivo | Línea | De | A |
|---|---|---|---|
| `src/middleware/authMiddleware.js` | 5 | `const SECRET = process.env.JWT_SECRET \|\| 'harito ama la playa';` | `const SECRET = require('../../common/jwtSecret');` |
| `src/components/auth/controller.js` | 7 | `const SECRET = process.env.JWT_SECRET \|\| 'change-me-please';` | `const SECRET = require('../../../common/jwtSecret');` |
| `src/components/user/controller.js` | 11 | `const SECRET = process.env.JWT_SECRET \|\| 'change-me-please';` | `const SECRET = require('../../../common/jwtSecret');` |
| `src/middleware/__tests__/authMiddleware.test.js` | 8 | `const SECRET = process.env.JWT_SECRET \|\| 'change-me-please';` | `const SECRET = require('../../../common/jwtSecret');` |
| `src/components/auth/__tests__/auth.controller.test.js` | 53 | `const SECRET = process.env.JWT_SECRET \|\| 'change-me-please';` | `const SECRET = require('../../../../common/jwtSecret');` |

- [x] **Step 3: Correr las suites afectadas**

Run: `pnpm.cmd jest --forceExit src/middleware src/components/auth`
Expected: **2 suites PASS, 0 tests fallidos** (los 8 tests rojos pasan).

---

### Task 2: Fix `Console.error` en app.js

**Files:**
- Modify: `public/js/app.js:922`

- [x] **Step 1: Corregir la mayúscula**

```js
// De:
          Console.error('Error during logout request', e);
// A:
          console.error('Error during logout request', e);
```

- [x] **Step 2: Verificar sintaxis**

Run: `node --check public/js/app.js`
Expected: exit code 0, sin salida.

---

### Task 3: `changeMyPassword` preserva el claim `tv` (TDD)

**Files:**
- Modify: `src/components/user/__tests__/user.controller.test.js`
- Modify: `src/components/user/controller.js:72-74`

- [x] **Step 1: Escribir el test (debe fallar primero)**

En `user.controller.test.js`, junto a los requires (línea ~72) agregar:

```js
const jwt = require('jsonwebtoken');
const SECRET = require('../../../../common/jwtSecret');
```

Reemplazar el test `'updates hash, increments passwordVersion and re-issues cookie'` (líneas 134-147) por:

```js
  test('updates hash, increments passwordVersion and re-issues cookie', async () => {
    const hash = bcrypt.hashSync('actual', 10);
    UserStore.prototype.findByIdFull.mockResolvedValue({ _id: 'u1', passwordHash: hash, role: [ROLES.INSTRUCTOR], passwordVersion: 2, tokenVersion: 1 });
    UserStore.prototype.update.mockResolvedValue({ _id: 'u1', role: [ROLES.INSTRUCTOR], passwordVersion: 3 });
    UserStore.prototype.findById.mockResolvedValue({ _id: 'u1', name: 'Ana', role: [ROLES.INSTRUCTOR], passwordVersion: 3 });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), cookie: jest.fn() };
    const req = { user: { id: 'u1' }, body: { currentPassword: 'actual', newPassword: 'nueva' } };
    await controller.changeMyPassword(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const updateArg = UserStore.prototype.update.mock.calls[0][1];
    expect(updateArg.passwordVersion).toBe(3);
    expect(updateArg.passwordHash).toEqual(expect.any(String));
    expect(res.cookie).toHaveBeenCalledWith('tokenAuth', expect.any(String), expect.any(Object));
    // El token re-emitido debe conservar tv: si no, una sesión previa con
    // tokenVersion ≥ 1 en DB quedaría inválida al instante tras el cambio.
    const newToken = res.cookie.mock.calls[0][1];
    const payload = jwt.verify(newToken, SECRET);
    expect(payload.pwdv).toBe(3);
    expect(payload.tv).toBe(1);
  });
```

- [x] **Step 2: Correr el test y verlo fallar**

Run: `pnpm.cmd jest --forceExit src/components/user/__tests__/user.controller.test.js -t "re-issues"`
Expected: FAIL con `expect(received).toBe(expected)` en `payload.tv` (`undefined` !== `1`).

- [x] **Step 3: Implementar el fix**

En `src/components/user/controller.js`, `changeMyPassword` (línea 72-76):

```js
      const token = sign(
        { userId: String(user._id), role: roles, sessionIat: Math.floor(Date.now() / 1000), pwdv: passwordVersion, tv: user.tokenVersion || 0 },
        SECRET,
        { expiresIn: ACCESS_TTL }
      );
```

- [x] **Step 4: Correr el test y verlo pasar**

Run: `pnpm.cmd jest --forceExit src/components/user/__tests__/user.controller.test.js`
Expected: PASS (todos los tests del archivo).

---

### Task 4: Tests nuevos — invalidación por tokenVersion

**Files:**
- Modify: `src/middleware/__tests__/authMiddleware.test.js`
- Modify: `src/components/auth/__tests__/auth.controller.test.js`

- [x] **Step 1: Habilitar `verify` en el test del middleware**

Línea 1: `const { sign, verify } = require('jsonwebtoken');`

- [x] **Step 2: Agregar 3 tests de tv al final del describe `authenticate`** (después del test `'returns 401 and clears cookie when user no longer exists'`)

```js
  test('returns 401 when tokenVersion (tv) mismatches DB', async () => {
    // Token emitido antes de un logout: DB tiene tokenVersion más alto
    UserStore.prototype.findById.mockResolvedValue({ _id: 'u1', passwordVersion: 0, tokenVersion: 1 });
    const req = cookieFor({ userId: 'u1', role: [ROLES.INSTRUCTOR], sessionIat: Math.floor(Date.now() / 1000), pwdv: 0, tv: 0 });
    const res = mockRes();
    await authenticate(req, res, jest.fn());
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Session expired');
    expect(res._cleared).toBe(true);
  });

  test('accepts token when tokenVersion matches DB', async () => {
    UserStore.prototype.findById.mockResolvedValue({ _id: 'u1', passwordVersion: 0, tokenVersion: 2 });
    const req = cookieFor({ userId: 'u1', role: [ROLES.INSTRUCTOR], sessionIat: Math.floor(Date.now() / 1000), pwdv: 0, tv: 2 });
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('u1');
  });

  test('sliding refresh preserves tv claim in the re-signed token', async () => {
    UserStore.prototype.findById.mockResolvedValue({ _id: 'u1', passwordVersion: 0, tokenVersion: 2 });
    // expiresIn '1m' < umbral de refresh (5 min) → se re-firma en el request
    const req = cookieFor({ userId: 'u1', role: [ROLES.INSTRUCTOR], sessionIat: Math.floor(Date.now() / 1000), pwdv: 0, tv: 2 }, '1m');
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalled();
    const newToken = res.cookie.mock.calls[0][1];
    const payload = verify(newToken, SECRET);
    expect(payload.tv).toBe(2);
  });
```

- [x] **Step 3: Agregar describe de logout al final de `auth.controller.test.js`**

```js
describe('AuthController.logout', () => {
  let controller;
  beforeEach(() => {
    controller = new AuthController();
    jest.clearAllMocks();
  });

  test('increments tokenVersion from a valid token and clears cookie', async () => {
    const token = sign(
      { userId: 'u9', role: [ROLES.INSTRUCTOR], sessionIat: Math.floor(Date.now() / 1000), pwdv: 0, tv: 0 },
      SECRET,
      { expiresIn: '20m' }
    );
    const req = { headers: { cookie: `tokenAuth=${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), clearCookie: jest.fn() };
    await controller.logout(req, res);
    expect(UserStore.prototype.incrementTokenVersion).toHaveBeenCalledWith('u9');
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('does not increment tokenVersion when token is invalid but still clears cookie', async () => {
    const req = { headers: { cookie: 'tokenAuth=not-a-jwt' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), clearCookie: jest.fn() };
    await controller.logout(req, res);
    expect(UserStore.prototype.incrementTokenVersion).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
```

Nota: el archivo ya hace `jest.mock('../../user/store')` (automock → `incrementTokenVersion` queda mockeado en el prototype) y requiere `sign` de `jsonwebtoken`… verificar: si no está, agregar `const { sign } = require('jsonwebtoken');` junto a `const jwt = require('jsonwebtoken');` existente (línea 52).

- [x] **Step 4: Correr ambas suites**

Run: `pnpm.cmd jest --forceExit src/middleware src/components/auth`
Expected: PASS, 0 fallos (incluye los 5 tests nuevos).

---

### Task 5: Limpieza (debug logs, código muerto, import sin usar)

**Files:**
- Modify: `src/middleware/authMiddleware.js`
- Modify: `src/components/auth/controller.js`
- Modify: `src/components/user/store.js:3`

- [x] **Step 1: Quitar logs de debug por request en `authMiddleware.js`**

- Línea ~101: eliminar `console.log(`[AUTH CHECK] DB tokenVersion: ${dbTv} | JWT tv: ${tokenTv}`);`
- Línea ~112: eliminar `console.log('authenticate middleware called', req.user ? `user already set: ${req.user.id}` : 'no user set');`

- [x] **Step 2: Quitar bloque comentado del chequeo viejo en `authMiddleware.js`**

Eliminar el bloque `// async function checkPasswordAndTokenVersion(res, payload) { ... }` completo (líneas ~74-89) y actualizar el comentario de la función viva:

```js
// Valida que los claims pwdv (versión de contraseña) y tv (versión de token)
// del token coincidan con la DB. Si cambiaron (logout o cambio de contraseña),
// los tokens emitidos antes quedan inválidos.
async function checkPasswordAndTokenVersion(res, payload) {
```

- [x] **Step 3: Quitar logout viejo comentado y log de éxito en `auth/controller.js`**

- Eliminar el bloque `// async logout(req, res) { ... }` comentado completo (líneas ~42-60).
- Dentro de `logout`, eliminar `console.log(`[AUTH] TokenVersion incrementado con éxito en DB para el usuario: ${payload.userId}`);`
- Conservar `console.error('[AUTH] Error interno durante el proceso de logout:', err);` (ruta de error) y el `console.log` de token inválido/expirado.

- [x] **Step 4: Quitar import sin usar en `user/store.js`**

Eliminar línea 3: `const UserModel = require('./models/User');`

- [x] **Step 5: Verificar que nada se rompió**

Run: `pnpm.cmd jest --forceExit src/middleware src/components/auth src/components/user`
Expected: PASS, 0 fallos.

---

### Task 6: Alinear `clearCookie` del logout con las opciones del set

**Files:**
- Modify: `src/components/auth/controller.js` (bloque `finally` de `logout`)

- [x] **Step 1: Reemplazar el clearCookie**

```js
    } finally {
      // Se limpia con las mismas opciones con las que se creó (sin maxAge:
      // Express lo convertiría en expires futuro y re-setearía la cookie
      // 20 min en vez de borrarla).
      const { maxAge: _ma, ...clearOpts } = isDeployed ? tokenCookieProduction : tokenCookieDevelopment;
      res.clearCookie('tokenAuth', clearOpts);

      return res.status(200).json({ message: 'Logout successful' });
    }
```

- [x] **Step 2: Correr tests de auth**

Run: `pnpm.cmd jest --forceExit src/components/auth`
Expected: PASS (los tests de logout mockean `clearCookie` y solo esperan que sea llamado).

---

### Task 7: Documentación y requerimientos

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

- [x] **Step 1: AGENTS.md — modelo User**

En el bloque del modelo Usuario, antes de `createdAt`, agregar:

```javascript
  passwordVersion: number, // Versión de contraseña (claim pwdv; al cambiarla mueren las otras sesiones)
  tokenVersion: number,    // Versión de token (claim tv; al hacer logout mueren las sesiones emitidas antes)
  createdAt: Date
```

(Solo agregar las líneas que falten; el bloque actual puede no tener `passwordVersion`.)

- [x] **Step 2: AGENTS.md — Requisitos No Funcionales**

Actualizar el bullet de `pwdv` y agregar bullets nuevos junto a él:

```markdown
- Claim JWT `pwdv` (passwordVersion): cambiar contraseña invalida otras sesiones (el middleware revalida contra la DB)
- Claim JWT `tv` (tokenVersion): `POST /auth/logout` incrementa `tokenVersion` en la DB del usuario; el middleware revalida `pwdv` y `tv` juntos en `checkPasswordAndTokenVersion`, así un token emitido antes del logout queda inválido aunque no haya expirado (afecta a todas las sesiones del usuario)
- Secret JWT centralizado en `common/jwtSecret.js`: middleware, controllers y tests comparten el mismo fallback si falta `JWT_SECRET`
```

- [x] **Step 3: AGENTS.md — Estado Actual**

Junto al bullet de autenticación JWT, agregar:

```markdown
- Logout invalida tokens en backend (claim `tv` / tokenVersion): el token anterior no sirve aunque no expire
```

- [x] **Step 4: README.md — sección "Flujo de autenticación y seguridad"**

Agregar al final de la sección:

```markdown
- Logout que invalida en el servidor: `POST /auth/logout` incrementa el `tokenVersion` del usuario; el middleware descarta cualquier token con `tv` desactualizado, así el token anterior deja de ser válido de inmediato aunque no expire
- Claims `pwdv` (cambio de contraseña) y `tv` (logout) revalidados contra la DB en cada request autenticado
```

---

### Task 8: Verificación final

- [x] **Step 1: Suite completa**

Run: `pnpm.cmd jest --forceExit`
Expected: `Tests: 0 failed` — total ~151 (145 originales + ~6 nuevos; 144+6=150 o 151 según conteo exacto de agregados).

- [x] **Step 2: Sintaxis del frontend**

Run: `node --check public/js/app.js`
Expected: exit code 0.

- [x] **Step 3: Revisar el diff completo**

Run: `git diff --stat` y `git diff`
Expected: solo los archivos de los Tasks 1-7; sin cambios inesperados.

- [x] **Step 4: Actualizar checkboxes del plan y reportar resultados.**

No se hace commit salvo que el usuario lo pida explícitamente.

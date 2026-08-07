# Diseño: "Mi cuenta" — edición de datos, cambio de contraseña y borrado de cuenta

Fecha: 2026-08-07

## Resumen

Feature self-service accesible desde el item "Mi cuenta" del menú de usuario (base, para todos los roles logueados). Permite editar nombre y apellido, cambiar la contraseña (pidiendo la actual) y eliminar la propia cuenta con confirmación por email. El email es inmutable (se usa como username) y los roles solo los adjudica/modifica el admin.

## Decisiones tomadas

1. UI: un modal con pestañas (Datos / Contraseña / Eliminar cuenta).
2. Al cambiar la contraseña se invalidan las otras sesiones activas (mecánica `passwordVersion` en el JWT).
3. Sin reglas de fortaleza de contraseña (solo no vacía, coherente con el registro actual).
4. Extras: info read-only del usuario, eliminar mi cuenta, confirmaciones visuales vía `aviso()`.
5. Eliminar cuenta: confirmación por email (segundo factor). No se bloquea por reservas: al confirmar el borrado desde el email, las reservas activas/futuras del usuario se **marcan como borradas** (soft-delete) y quedan invisibilizadas del calendario pero presentes en la DB. No se hard-deletean.
6. El soft-delete es solo para reservas activas/futuras confirmadas; se ejecuta al momento de la confirmación del borrado (no al pedirlo), para que "Cancelar borrado" no toque reservas.
7. Email inmutable en todo el sistema (incluido el admin).

## Alcance

### Backend — self-service (`src/components/user/`)

Endpoints nuevos (autenticados salvo indicación contraria):

- `PUT /users/me/profile`
  - Body: `{ name, surname }`.
  - Solo acepta `name` y `surname` (trim, requeridos). Se descartan `email`, `role` y cualquier otra clave del body.
  - Devuelve el usuario sanitizado (200) o error 400.
- `PUT /users/me/password`
  - Body: `{ currentPassword, newPassword }`.
  - Verifica `currentPassword` con bcrypt contra el hash guardado. Si falla → 401 `{ error: 'Contraseña actual incorrecta' }`.
  - `newPassword` no vacío (sin reglas de largo).
  - Actualiza `passwordHash`, incrementa `passwordVersion`, setea `updatedAt`.
  - Re-emite el token JWT (cookie `tokenAuth`) con el nuevo `pwdv` para que la sesión actual siga viva.
  - Devuelve el usuario sanitizado (200).
- `DELETE /users/me`
  - Body: `{ password }`.
  - Verifica la contraseña (401 si falla).
  - Cuenta las reservas activas/futuras del usuario (para informarlo en el modal) y lo incluye en la respuesta como `activeBookings`. **No modifica reservas** en este paso.
  - Genera `deleteAccountToken` (hex aleatorio) + `deleteAccountExpires` (20 min), los guarda en el usuario, envía email de confirmación. Si el envío falla → 500 `{ error: 'No pudimos enviar el correo de confirmación. Reintenta.' }` y limpia el token (no queda pendiente).
  - En éxito responde (200): `{ message: 'Te hemos enviado un correo para confirmar el borrado.', activeBookings: n }`. La sesión sigue viva hasta confirmar o expirar el token.
- `POST /users/me/cancel-delete`
  - Limpia `deleteAccountToken`/`deleteAccountExpires`. 200. Idempotente. No toca reservas.
- `POST /delete-account/:token` — público (el token es la credencial)
  - Busca usuario por `deleteAccountToken` + `deleteAccountExpires > now`. Inválido/expirado → 400 `{ error: 'El enlace es inválido o ha expirado' }`.
  - Marca como borradas (soft-delete) las reservas activas/futuras del usuario (nunca hard-delete).
  - Borra la cuenta, limpia la cookie `tokenAuth`. 200 `{ message: 'Cuenta eliminada correctamente' }`.
- `PUT /users/:id` (existente): se agrega `delete updates.email` siempre (owner y admin). El email no se puede cambiar en el sistema.

Los roles solo se adjudican/modifican por admin (`POST /users/:id/promote`, `POST /users`, `PUT /users/:id` como admin). El path self-service no toca `role`.

### Seguridad de sesión — `src/middleware/authMiddleware.js`

- Login y register firman el JWT con `pwdv: user.passwordVersion`.
- Sliding refresh: preserva `pwdv` del payload anterior (ya validado en el mismo request).
- `authenticate` y `authenticateAdmin`: tras verificar el token y antes de chequear rol/continuar, leen `passwordVersion` del usuario con `UserStore.findById(id)` (query indexada, incluye `passwordVersion`) y lo comparan con `payload.pwdv`. Si difieren (o el usuario ya no existe) → 401 + `clearCookie('tokenAuth')` (sesión inválida por cambio de contraseña).
- Compatibilidad legacy: tokens sin `pwdv` → `payload.pwdv || 0`; usuarios sin campo `passwordVersion` → `user.passwordVersion || 0`. Ambos dan 0 y matchean, no hace falta backfill.
- Nota de tests: los tests unitarios de `authMiddleware` pasan tokens reales (no shim `req.user`), así que los casos exitosos deberán mockear `UserStore.findById` devolviendo el `passwordVersion` esperado. Los casos de 401 por tope de sesión/expiración cortan antes del chequeo de `pwdv` y no necesitan mock.
- Los tests de network/components usan shim `req.user`, por lo que no se ven afectados.

### Modelo y stores

- `User` (`src/components/user/models/User.js`):
  - Nuevo campo `passwordVersion` (default `0`).
  - Nuevos campos `deleteAccountToken` (null) y `deleteAccountExpires` (null).
  - `toJSON()` ya oculta `passwordHash` y `resetPasswordToken`; agregar `deleteAccountToken` a la lista oculta.
- `UserStore` (`src/components/user/store.js`):
  - `findByIdFull(id)`: devuelve el doc completo incluyendo `passwordHash` (para verificar contraseñas).
  - `setDeleteToken(userId, token, expires)`.
  - `findByDeleteToken(token)` (valida `deleteAccountExpires > now`).
  - `clearDeleteToken(userId)`.
  - `findById`/`findAll`/`update` deben seguir ocultando `passwordHash`, `resetPasswordToken` y `deleteAccountToken`.
- `Booking` (`src/components/bookings/models/Booking.js`):
  - Nuevos campos `deleted` (default `false`) y `deletedAt` (default `null`). El soft-delete no cambia `status`.
- `BookingStore` (`src/components/bookings/store.js`):
  - `findActiveByUser(userId)`: reservas con `status='confirmed'`, no borradas y `endDate >= hoy` (o `endDate` ausente).
  - `softDeleteActiveByUser(userId)`: marca como borradas las reservas activas/futuras de un usuario (`$set: { deleted: true, deletedAt: new Date() }`). Devuelve `modifiedCount`.
  - `findAll`, `findByWorkspace` y `findByWorkspaceAll` deben excluir las reservas borradas (`deleted: { $ne: true }`), para que no aparezcan en el calendario ni bloqueen solapamientos.

Definición de reserva activa/futura: `status === 'confirmed'`, `deleted !== true` y `endDate >= fecha de hoy (YYYY-MM-DD)` o `endDate` no presente.

### Frontend (`public/js/app.js`, `public/js/menu.js`, `public/css/styles.css`)

- Wire del item `'mi-cuenta'`: `ResClassroomMenu.init({ logout, 'mi-cuenta': openMiCuentaModal })`. `menu.js` no requiere cambios (el item ya existe).
- Modal con 3 pestañas (patrón de los modales existentes):
  - **Datos**: email (read-only), rol, "miembro desde" (fecha de alta) + inputs nombre/apellido + Guardar → `PUT /users/me/profile`. Al éxito: actualiza `sessionStorage.username` (solo el nombre), cierra/limpia el formulario, `aviso('Datos actualizados')`.
  - **Contraseña**: contraseña actual, nueva, repetir nueva + Guardar → `PUT /users/me/password`. Validación cliente: repetir debe coincidir. Al éxito: `aviso('Contraseña actualizada. Otras sesiones fueron cerradas.')`.
  - **Eliminar cuenta**: zona de peligro. Input de contraseña + botón "Eliminar mi cuenta".
    - Estado pendiente: la app guarda la flag `pendingAccountDeletion` en `sessionStorage` cuando `DELETE /users/me` responde 200. Si está activa, la pestaña muestra "Tienes un borrado pendiente" + botón "Cancelar borrado" (`POST /users/me/cancel-delete`) en lugar del formulario de eliminación. La flag se limpia al cancelar o al confirmar el borrado desde el email (en ese caso el flujo de logout de la app la limpia).
    - Al intentar eliminar → `DELETE /users/me` con la contraseña. Si responde 200 → `aviso('Te hemos enviado un correo para confirmar el borrado.')`, setea `pendingAccountDeletion` y muestra el estado pendiente con "Cancelar borrado". Si `activeBookings > 0`, el aviso aclara que esas reservas se marcarán como borradas y quedarán a disposición del admin.
  - Todos los fetches protegidos pasan por `handleAuthError` (401 → logout).
- Nueva página `public/delete-account.html` (espejo de `reset-password.html`):
  - Extrae el token de la URL (`/delete-account/:token`).
  - `POST /delete-account/:token` → éxito: mensaje de cuenta eliminada + link al home. Error: muestra el mensaje.
- `EmailService` (`src/components/reset-password/emailService.js`):
  - Nuevo método `sendDeleteAccountEmail(email, confirmUrl)` con asunto y cuerpo acordes, aviso de expiración en 20 min y de "si no solicitaste esto, ignora el correo".

### Confirmaciones visuales

Se usa el helper `aviso()` existente. Los mensajes clave quedan definidos arriba.

## Errores y códigos HTTP

| Caso | Código | Cuerpo |
| --- | --- | --- |
| Contraseña actual incorrecta (password o delete) | 401 | `{ error: 'Contraseña actual incorrecta' }` |
| Campos faltantes (profile/password/delete) | 400 | `{ error: '<detalle>' }` |
| Clave no permitida en profile (email/role/otra) | 400 | `{ error: 'Campo no permitido: <clave>' }` |
| Token de borrado inválido/expirado | 400 | `{ error: 'El enlace es inválido o ha expirado' }` |
| Falla al enviar email de confirmación | 500 | `{ error: 'No pudimos enviar el correo de confirmación. Reintenta.' }` |
| Sesión inválida (pwdv desactualizado) | 401 | `{ error: 'Session expired' }` + clearCookie |

## Testing

- Unitarios nuevos:
  - `user.controller.test.js`: profile rechaza email/role/claves extra; password con contraseña errónea → 401; correcta → actualiza hash + versiona; delete con reservas activas → genera token, envía email (mock) y responde `activeBookings` sin modificar reservas; cancel-delete limpia token; `PUT /users/:id` bloquea email.
  - `authMiddleware.test.js` (actualizar): mockear `UserStore.findById` y agregar casos de `pwdv` desactualizado → 401 + clearCookie, y usuario inexistente → 401.
  - Stores (`UserStore`/`BookingStore`): `findByIdFull`, `setDeleteToken`, `findByDeleteToken`, `clearDeleteToken`, `findActiveByUser`, `softDeleteActiveByUser` (y que `findAll`/`findByWorkspace`/`findByWorkspaceAll` excluyen las borradas).
- Regresión: los 36 tests existentes deben seguir pasando (`pnpm test`).
- Nota: la suite de integración de bookings puede fallar por `EADDRINUSE` preexistente al correr ambas suites juntas (conocido).

## Fuera de alcance

- Preferencia de tema claro/oscuro.
- Sistema de notificaciones completo (solo se usan `aviso()` y el email de confirmación).
- Edición de otros campos de usuario (avatar, ubicación, etc.).
- Gestión de usuarios por admin (modal de gestión, pendiente; solo se protege el email en `PUT /users/:id`).
- **Gestión de reservas por admin (futuro)**: reasignar reservas soft-deleted a otro instructor/usuario, buscarlas en la DB y borrarlas definitivamente. Esta spec solo deja las reservas marcadas (`deleted: true` + `deletedAt`) para que esa feature las encuentre; no implementa el panel del admin. Tampoco implementa la reasignación de reservas sin borrado de cuenta.

# Diseño: Cursos — propuesta, votación SUBCO, publicación y reservas

Fecha: 2026-08-10

## Resumen

Feature que introduce **cursos** como entidad de primer nivel, asociados a las reservas de workspaces. Un curso transita un ciclo: **borrador** (construcción de la propuesta) → **votación en la SUBCO** (48hs, umbral configurable) → **aprobación/rechazo** → **publicación** (creación automática de las reservas). Los cursos se reservan en workspaces del club (aula = `name` del workspace, sede = `location`) mediante una **grilla de bloques flexibles** (cada bloque puede ser un aula reservable o un espacio público no reservable). Durante la votación, los bloques con workspace se materializan como **soft bookings** que bloquean colisiones.

## Decisiones tomadas

1. **Aula/Sede**: un curso usa workspaces existentes. `name` del workspace = aula/espacio (Aula principal, Murito, Quincho, Boulder...); `location` = sede/edificio (Rivadavia 1255, Bucareli...). La sede se deriva del workspace, no se repite en el curso.
2. **Grilla flexible de bloques**: el curso tiene `schedule.blocks[]`. Cada bloque = workspace (reservable) **o** espacio público no reservable (ej: clases prácticas en el parque). Los bloques de espacio público **no generan reserva** pero se muestran en los datos del curso. Un curso puede reservar 2+ workspaces distintos (ej: teórica en el aula + práctica en el boulder).
3. **Borrador (`propuesto`)**: al crear un curso queda como borrador, guardado parcialmente (solo `title` requerido), vinculado al creador. No genera soft bookings, no es visible a SUBCO ni al calendario público. Solo lo ve su creador y el admin. Se puede editar/borrar libremente. Se envía a votación con una acción explícita ("Enviar a votación") que valida campos completos + chequea colisiones.
4. **Rechazado/retirado → vuelve a borrador**: el proponente puede llevar un curso `rechazado` o `retirado` de vuelta a `propuesto` para corregirlo y reenviarlo (nuevo ciclo de votación), o borrarlo si es insalvable.
5. **Votantes**: los usuarios con rol `subco` (multirole; el admin ya puede asignar/remover el rol vía `PUT /users/:id`). El número de integrantes es dinámico según cuántos tengan el rol.
6. **Ventana de votación**: 48hs desde el envío (o desde la última edición, que la reinicia). El que no votó al vencerse el plazo se computa como **abstención**.
7. **Fórmula de aprobación**: `positivos / (positivos + negativos) >= 0.75` (abstenciones no cuentan en el denominador). Si no hay votos explícitos → no aprobado. Umbral configurable.
8. **Cierre temprano**: si votan *todos* los miembros SUBCO antes de las 48hs, el resultado se resuelve en el momento. Si no, al vencer el plazo se resuelve automáticamente (lazy, sin cron: se evalúa al votar o al consultar el curso).
9. **Re-voto**: mientras la votación esté abierta, un miembro puede re-votar; su voto **reemplaza** el anterior (idempotente por `userId`).
10. **Edición durante la votación**: cualquier edición del creador a un curso en `en_votacion` **borra los votos y reinicia el plazo** a 48hs (regla simple, sin excepciones por campo), recrea los soft bookings y avisa a SUBCO por email para re-votar.
11. **Estados aprobado/publicado/en_curso**: se puede ajustar la grilla **sin re-votación** (para resolver conflictos), actualizando las reservas afectadas con re-chequeo de colisión.
12. **Soft booking = booking con `status: 'pending'`** en la colección `bookings` (Opción A). Al aprobarse → flip `pending → confirmed`. Al rechazar/retirar/cancelar → soft-delete. Los `pending` **bloquean colisiones para todos**: el `checkOverlap` existente no distingue roles, así que cualquier intento de reservar (o proponer) un espacio soft-reservado recibe 409. La salida para desbloquear es cancelar/retirar la propuesta que lo ocupa (no hay override de admin vía checkOverlap).
13. **Publicación automática**: al aprobarse se crean/confirman las reservas automáticamente y el curso pasa a `publicado` (visible a todos). Sin paso manual. El proponente recibe email con el resumen.
14. **Inscripción**: los campos económicos/de cupos/formulario son **informativos** (ficha publicada). No hay submódulo de inscripción ni conteo de cupos.
15. **Colisiones en vivo**: el borrador muestra avisos de colisión al configurar los bloques, antes de enviar.
16. **Notificaciones**: emails a SUBCO con **link directo a la votación** (propuesta nueva o re-editada); email al proponente al aprobarse/rechazarse. Badge en la app con la cantidad de votaciones pendientes para cada miembro SUBCO.
17. **Umbral y ventana configurables**: constantes al tope de `courses/controller.js`, con override por variables de entorno (`COURSE_APPROVAL_RATIO`, `COURSE_VOTE_WINDOW_HOURS`).
18. El botón flotante `+` pasa a ser **"Crear Curso"**. La creación directa de reservas puntuales se retira de la UI (decisión abierta a futuro: un acceso secundario para reservas ad-hoc no-curso).

## Alcance

### Backend — nuevo componente `src/components/courses/`

Estructura: `network.js`, `controller.js`, `store.js`, `models/Course.js`, `emailService.js`, `__tests__/`.

Endpoints (bajo `/courses`, autenticados salvo indicación):

- `GET /courses` — Lista según rol:
  - Visitor: solo `publicado | en_curso | finalizado`.
  - Instructor: + sus borradores (`propuesto` por él) y sus propuestas en cualquier estado.
  - Subco: + todo `en_votacion` y el histórico completo (rechazados, retirados, cancelados).
  - Admin: todo (incluidos borradores ajenos).
- `GET /courses/:id` — Detalle con la misma visibilidad por rol/estado.
- `POST /courses` — Crea borrador (solo instructor). Valida `title`; resto opcional.
- `PUT /courses/:id` — Edición según estado:
  - `propuesto`: creador (o admin). Libre, sin efectos colaterales.
  - `en_votacion`: creador. Borra votos, reinicia `voteDeadline` a +48h, recrea los soft bookings con los nuevos bloques (delete + insert), email a SUBCO para re-votar.
  - `aprobado | publicado | en_curso`: creador/subco/admin. Ajuste de grilla sin re-votación; actualiza (o crea/borra) las reservas afectadas con re-chequeo de colisión. No toca votos.
- `POST /courses/:id/submit` — "Enviar a votación" (creador). Valida campos requeridos completos + chequeo de colisiones (contra reservas `confirmed` y `pending` de otras propuestas). Si un bloque colisiona → 409 con detalle y no envía. Éxito: status `en_votacion`, `voteDeadline = now + 48h`, crea soft bookings, email a SUBCO.
- `POST /courses/:id/vote` — Votar (subco). Body: `{ vote: 'positive'|'negative'|'abstain', comment? }`. Reemplaza el voto previo del usuario. Evalúa cierre temprano (si votaron todos) y transiciona si corresponde.
- `POST /courses/:id/withdraw` — Retirar (creador, `en_votacion`). Status `retirado`, soft-delete de soft bookings.
- `POST /courses/:id/back-to-draft` — Volver a borrador (creador). Desde `rechazado`/`retirado` → `propuesto`. Limpia residuos de soft bookings.
- `POST /courses/:id/cancel` — Cancelar (admin o creador; `publicado | en_curso`). Status `cancelado`, soft-delete de las reservas.
- `DELETE /courses/:id` — Solo borradores `propuesto` (creador o admin). Los estados vivos se cancelan, no se borran.
- `GET /courses/pending-count` — (subco) cantidad de `en_votacion` sin el voto del usuario (para el badge).
- `GET /courses/check-conflicts` — (logueado) chequeo liviano para avisos en vivo en el borrador. Query: workspaceId, startDate, endDate, days, startTime, endTime → lista de colisiones contra `confirmed` y `pending`.

Constantes al tope de `controller.js`:

```javascript
const APPROVAL_RATIO = Number(process.env.COURSE_APPROVAL_RATIO || 0.75);
const VOTE_WINDOW_HOURS = Number(process.env.COURSE_VOTE_WINDOW_HOURS || 48);
```

### Backend — cambios en `Booking` (`src/components/bookings/`)

- `Booking` (modelo): campo nuevo `courseId`.
- Soft booking: `status: 'pending'`.
- `GET /bookings` (network: público detrás de `auth.authenticate`; `req.user` puede ser `null`):
  - Sin sesión (visitante): solo `status: 'confirmed'`.
  - Logueado (instructor/subco/admin): también `pending` (el frontend los dibuja punteados).
- Detección de conflictos: sin cambios (`findByWorkspaceAll` ya devuelve los `pending` porque solo excluye `deleted`).
- Soft-delete de cuenta: `softDeleteActiveByUser` filtra por `status: 'confirmed'`, por lo que los `pending` no se ven afectados.

### Modelo de datos — colección `courses`

```javascript
{
  _id: ObjectId,
  title: string,              // Nombre del curso (requerido)
  type: string,               // Tipo (taller, capacitación...)
  description: string,        // Descripción
  proposal: string,           // Texto largo: alcance, presupuesto, info del excel/pdf
  proposalUrl: string,        // (opcional) link al documento original

  coordinator: {              // Coordinador
    name: string,
    email: string,
    phone: string,
    contactFormUrl: string    // Formulario de contacto (link)
  },

  schedule: {
    startDate: string,        // Inicio de actividad (YYYY-MM-DD)
    endDate: string,          // Finalización
    blocks: [                 // Grilla de cursada
      {
        label: string,               // ej: "Teórica", "Práctica"
        workspaceId: string | null,  // null = espacio público no reservable
        workspaceName: string,       // snapshot del nombre (aula o espacio público)
        location: string,            // snapshot de la sede
        isPublicSpace: boolean,      // true → no genera reserva
        days: number[],              // 0-6 (Dom..Sáb)
        startTime: string,           // HH:mm
        endTime: string              // HH:mm
      }
    ]
  },

  price: { socio: number, nonSocio: number },
  capacity: { min: number, max: number },
  enrollmentDeadline: string, // Fecha cierre de inscripción (YYYY-MM-DD)
  color: string,              // Color del curso en calendario
  notes: string,              // Comentarios / info adicional

  proposedBy: userId,
  proposedAt: Date,
  voteDeadline: Date,         // Reinicia a +48h al editar durante la votación
  votes: [                    // Solo votos explícitos (a favor/en contra/abstención)
    { userId, vote: 'positive'|'negative'|'abstain', comment, votedAt }
  ],
  status: 'propuesto'|'en_votacion'|'aprobado'|'rechazado'|'publicado'|'en_curso'|'finalizado'|'cancelado'|'retirado',
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  updatedBy: userId
}
```

### Máquina de estados

```
[propuesto] (borrador) ──submit──▶ [en_votacion] ──▶ aprobado ─▶ publicado ─▶ en_curso ─▶ finalizado
      ▲                               │
      └────── back-to-draft ◀──────── retirado / rechazado (rework o borrado)
```

- `en_votacion` → `aprobado` | `rechazado`: cierre temprano (votaron todos) o al vencer `voteDeadline` (ausentes = abstención).
- `aprobado` → `publicado`: automático (flip `pending→confirmed`). Transición conceptual; puede persistirse directo como `publicado`.
- `publicado` → `en_curso` → `finalizado`: lazy por fecha (`startDate <= hoy`, luego `endDate < hoy`), evaluado al consultar.
- `publicado`/`en_curso` → `cancelado`: admin o creador (soft-delete de reservas).
- `en_votacion` → `retirado`: creador (soft-delete de soft bookings).
- `rechazado`/`retirado` → `propuesto`: creador (back-to-draft).

### Cálculo de aprobación

- Votantes = usuarios con rol `subco` (se consultan vivos en la DB, no se cachea).
- `positivos` = votos `'positive'`; `negativos` = votos `'negative'`.
- Abstenciones (explícitas o por ausencia) no cuentan en el denominador.
- **Aprobado** si `positivos + negativos > 0` y `positivos / (positivos + negativos) >= APPROVAL_RATIO`.
- Sin votos explícitos → no aprobado (rechazado al cierre).

### Emails — `src/components/courses/emailService.js`

Mismo patrón nodemailer que `reset-password/emailService.js`. Métodos:
- Propuesta nueva / re-editada → a cada miembro SUBCO con **link directo a la votación** (URL `/cursos` o `/votar` según APP_URL).
- Aprobado → al proponente (resumen de reservas creadas).
- Rechazado → al proponente.

### Frontend

- **FAB `+` → "Crear Curso"** (`index.html`/`app.js`): abre el modal de curso en modo borrador. La reserva puntual directa se retira de la UI.
- **Modal de curso** (nuevo): secciones Datos generales / Propuesta / Coordinador / Económico-inscripción / Grilla de bloques (dinámica) / Avisos de colisión en vivo (`/courses/check-conflicts`). Botones "Guardar borrador" y "Enviar a votación".
- **Página "Cursos"** (item de menú ya existente): tabs Mis borradores / En votación / Publicados / Histórico. Cards con acciones según rol/estado.
- **Página "Votar"** (solo subco): lista de `en_votacion` con detalle, tiempo restante, conteo parcial, botones A favor / En contra / Abstenerse + comentario opcional; re-voto reemplaza.
- **Badge de votación pendiente**: consulta `GET /courses/pending-count` al loguear y junto al watchdog (`/auth/me` cada 60s). Si > 0, badge en el item "Votar".
- **Calendario**: los `pending` se dibujan **punteados** y solo para logueados (instructor/subco/admin) como "Propuesta en votación — Curso X". Visitantes solo ven `confirmed`. Al aprobarse pasan a sólidos (color del curso).
- **Menú** (`public/js/menu.js`): `cursos` visible para instructor/subco/admin; `votar` solo subco. `mis-reservas` sigue placeholder.

### Permisos

- **Crear borrador / enviar a votación / retirar / volver a borrador / borrar borrador**: instructor (creador).
- **Editar**: creador según estado (ver tabla de endpoints). En `aprobado/publicado/en_curso`: creador/subco/admin (sin re-votación).
- **Votar**: subco.
- **Cancelar**: admin o creador (`publicado`/`en_curso`).
- **Ver**: por rol (ver `GET /courses`).
- Los `pending` bloquean colisiones para todos (el `checkOverlap` existente no distingue roles); la salida es cancelar/retirar la propuesta que ocupa el espacio.

## No funcional / seguridad

- Se reutilizan las convenciones del proyecto: capas network → controller → store → models, errores con try/catch y códigos HTTP apropiados.
- Comentarios en español, explicando el "por qué".
- Las constantes `APPROVAL_RATIO` y `VOTE_WINDOW_HOURS` con fallback si falta la env var.
- La lista de votantes se lee de la DB en cada evaluación (nunca cacheada), para reflejar cambios de rol al instante.

## Fuera de alcance (explícito)

- Submódulo de inscripciones/cupos/pagos (los campos son informativos).
- Subida de archivos adjuntos (excel/pdf): se ingresa la info como texto en `proposal` + link opcional `proposalUrl`.
- Reservas ad-hoc no-curso (decisión abierta; el FAB ahora crea cursos).
- Sistema de notificaciones general (solo badge de votos pendientes + emails del ciclo).
- Panel admin de gestión de reservas soft-deleted (sigue pendiente de un feature aparte).

## Tests

### Unitarios (`src/components/courses/__tests__/`)
- Modelo `Course`: validación por estado (borrador = `title`; envío = campos completos), normalización de bloques, snapshots de workspace/sede.
- Lógica de votación (función pura): umbral (3/4, 2/3, todos abstención → rechazado, umbral configurable), cierre temprano, deadline con ausentes → abstención, re-voto reemplaza, resolución lazy por fecha.
- Colisiones: bloque vs `confirmed` y vs `pending` de otra propuesta.
- Visibilidad por rol de `GET /courses` y de `GET /bookings` (pending solo logueados).

### Integración (`test/integration/courses.integration.test.js`)
- Feliz: crear borrador → editar → submit (crea soft bookings + email) → votan todos → aprobado → flip `pending→confirmed`.
- Rechazo por cierre sin quórum → soft bookings liberados.
- Editar en `en_votacion` → votos a cero + plazo reiniciado + soft bookings recreados + email.
- Retirar / volver a borrador / cancelar → estados y reservas correctos.
- Submit con colisión → 409 sin soft booking.
- Permisos: visitor no crea; no-subco no vota; reglas de edición por estado.

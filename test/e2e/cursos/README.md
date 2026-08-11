# Prueba E2E del flujo completo de Cursos (Playwright)

Corre la app y ejecuta la prueba contra la base real (Atlas). Requiere `node`, `python3`, `playwright` (Python) y el entorno de la app funcionando.

## Qué verifica

Flujo completo de una propuesta de curso:

1. **Instructor**: crea un borrador (FAB +), lo ve en "Mis borradores" y lo envía a votación.
2. **Subco**: ve el badge de votación pendiente, vota a favor, la card refleja el voto y el badge se oculta.
3. **Calendario**: el día reservado muestra el dot punteado de la propuesta pendiente y, al hacer click, la card trae el tag "Propuesta en votación" y no permite editar/eliminar.
4. **Visitante**: NO ve la propuesta en el día.
5. **Deep-link**: `/?votar=<id>` abre la vista de votación.
6. Sin errores de JS en consola.

## Requisitos

- Variables en `.env` (DB_ATLAS) como el resto de la app.
- Playwright Python instalado: `pip install playwright && playwright install chromium`.
- El helper `with_server.py` de `.agents/skills/webapp-testing/scripts/with_server.py` (levanta y detiene el server).

## Cómo correr

```powershell
# 1. Seed: crea usuarios/workspace de test en Atlas y escribe state.json
node test/e2e/cursos/seed.js

# 2. Levanta el server y corre la prueba (desde la raíz del repo)
python .agents/skills/webapp-testing/scripts/with_server.py `
  --server "node src/server.js" --port 3000 --timeout 60 `
  -- python test/e2e/cursos/e2e_cursos.py

# 3. Limpieza: borra usuarios/workspace/cursos/bookings de test por _id
node test/e2e/cursos/cleanup.js
```

## Notas

- El seed es idempotente: limpia restos de corridas abortadas (usuarios `e2e-*@test.com`, workspace "Aula E2E" y cursos "Taller E2E...") antes de crear los datos nuevos.
- El cleanup borra SOLO los `_id` registrados en `state.json` (nunca toca usuarios pre-existentes) y elimina `state.json`.
- `TITLE`, `DATE` y los selectores del script están fijados para este flujo; si cambiás el día/workspace, ajustá `DATE`/`TITLE` y el seed en consecuencia.
- El día de test (martes 2026-08-11) puede tener otras reservas reales; el script valida que haya al menos un dot `dashed` (no el primero).
- En PowerShell usar `pnpm.cmd` (no `pnpm.ps1`).

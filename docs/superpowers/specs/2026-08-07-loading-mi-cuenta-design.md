# Diseño: Estado de espera en el modal "Mi cuenta"

## Problema

Al enviar los formularios del modal "Mi cuenta" (Guardar cambios, Cambiar contraseña, Eliminar cuenta), la respuesta del servidor tarda 1-2 s (en el borrado, por el envío del email). Durante ese tiempo la UI no da ninguna señal: parece que el botón no funcionó hasta que aparece el aviso.

## Objetivo

Mientras una petición del modal esté en vuelo:

- Atenuar sutilmente el contenido del modal.
- Congelar todas las acciones: no se puede escribir en inputs, cambiar de pestaña, usar el botón de cerrar ni clickear el backdrop.
- Mostrar un spinner con "Enviando…" como señal de procesamiento.

Aplicar a las 3 acciones del modal (Datos, Contraseña, Eliminar cuenta), elegido por el usuario.

## Enfoque elegido

**B. Overlay dentro del modal** (aprobado por el usuario). Un único mecanismo para las 3 acciones:

### `public/js/app.js`

1. En el template de `openMiCuentaModal`, agregar un overlay oculto:

   ```html
   <div id="accountBusyOverlay" class="account-busy-overlay" hidden>
     <span class="spinner" aria-hidden="true"></span>
     <p>Enviando…</p>
   </div>
   ```

2. Helper `setAccountBusy(modal, busy)`:
   - Alterna la clase `account-busy` en el elemento `.modal` (no solo `.modal-content`) para que el bloqueo cubra también el click en el backdrop.
   - Alterna `hidden` en `#accountBusyOverlay`.

3. En los 3 submit handlers (`miCuentaProfileForm`, `miCuentaPasswordForm`, `miCuentaDeleteForm`):
   - `setAccountBusy(modal, true)` antes del `fetch`.
   - `setAccountBusy(modal, false)` en un `finally`, para liberar siempre (éxito, error HTTP o error de red).

4. Guardar los cierres mientras hay carga:
   - El handler del botón `#miCuentaClose` y el del backdrop (`e.target === modal`) ignoran el cierre si `modal.classList.contains('account-busy')`.

### `public/css/styles.css`

- `.account-busy-overlay`:
  - `position: absolute; inset: 0;`
  - `display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;`
  - Fondo sutil: `rgba(15, 23, 42, 0.55)` con `backdrop-filter: blur(2px)`.
  - `border-radius` acorde al modal, `z-index` alto.
  - Al cubrir todo el contenido, captura los clicks (bloquea inputs, pestañas y botón de cerrar).
- `.spinner`:
  - Círculo 28px, `border: 3px solid rgba(255,255,255,0.25)`, `border-top-color: var(--brand-blue-light)`, `border-radius: 50%`.
  - Animación `spin` 0.8s linear infinite.
- `@keyframes spin { to { transform: rotate(360deg); } }`.
- El `.modal-content` del modal Mi cuenta queda `position: relative` para anclar el overlay.

## Manejo de errores

El `finally` garantiza quitar el estado de espera ante cualquier resultado. Los avisos actuales (`aviso(...)`) y el flujo de error existente no cambian.

## Verificación

- `app.js` no tiene harness de tests (patrón existente del repo): verificación manual.
- Manual: en cada botón el overlay aparece al instante; no se puede escribir, cambiar de pestaña ni cerrar mientras dura; desaparece al llegar la respuesta, tanto en éxito como en error.
- Correr la suite unitaria completa (`pnpm test`) para confirmar que nada se rompe.

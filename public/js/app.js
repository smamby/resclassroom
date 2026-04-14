document.addEventListener('DOMContentLoaded', () => {
    const calendarGrid = document.getElementById('calendarGrid');
    const currentMonthEl = document.getElementById('currentMonth');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const selectedDateEl = document.getElementById('selectedDate');
    const dayActivitiesEl = document.getElementById('dayActivities');
    const workspaceSelect = document.getElementById('workspaceSelect');
    const activitySelect = document.getElementById('activitySelect');
    const dayFilter = document.getElementById('dayFilter');
    const btnNewReservation = document.getElementById('btnNewReservation');
    const reservationModal = document.getElementById('reservationModal');
    const closeModalBtn = document.getElementById('closeModal');
    const reservationForm = document.getElementById('reservationForm');

    let currentDate = new Date();
    let selectedDay = null;
    // Bookings data will be loaded from the API and mapped to the UI shape
    let bookings = [];
    // Real workspaces loaded from DB
    let workspacesFromApi = [];
    const workspacesById = {};

    async function fetchWorkspacesFromApi() {
      try {
        const res = await fetch('/workspaces', { credentials: 'include' });
        const data = await res.json();
        // Prefer the business id field first when available, fallback to _id
        workspacesFromApi = data.map(ws => ({ id: ws._id, name: ws.name, location: ws.location || '' }));
        // Build a lookup map by id with name and location
        workspacesFromApi.forEach(ws => {
          workspacesById[ws.id] = { name: ws.name, location: ws.location || '' };
        });
      } catch (e) {
        workspacesFromApi = [];
      }
    }

    // Load bookings from API and map to UI shape (slots-based)
    async function fetchBookingsFromApi() {
      try {
        const res = await fetch('/bookings', { credentials: 'include' });
        const data = await res.json();
        bookings = data.map(b => {
          const wsId = b.workspaceId;
          const wsData = workspacesById[wsId] || { name: b.workspaceName || wsId, location: '' };
          const wsName = wsData.location ? `${wsData.name} (${wsData.location})` : wsData.name;
          const start = b.startDate || b.date;
          const end = b.endDate || b.date;
          // Expand recurrence into per-date slots using UTC-based arithmetic to avoid timezone drift
          let slots = [];
          if (start && end) {
            const s = start.split('-').map(n => parseInt(n, 10)); // [Y, M, D]
            const e = end.split('-').map(n => parseInt(n, 10));
            const base = Date.UTC(s[0], s[1]-1, s[2]);
            const endBase = Date.UTC(e[0], e[1]-1, e[2]);
            const allowedDays = Array.isArray(b.days) ? b.days : [];
            for (let t = base; t <= endBase; t += 86400000) {
              const d = new Date(t);
              const dow = d.getUTCDay();
              if (allowedDays.length === 0 || allowedDays.includes(dow)) {
                slots.push({ date: d.toISOString().slice(0,10), startTime: b.startTime, endTime: b.endTime, color: b.color });
              }
            }
          }
          if (slots.length === 0) {
            slots = [{ date: start, startTime: b.startTime, endTime: b.endTime }];
          }
          return {
            id: String(b._id || b.id),
            workspace: wsId,
            workspaceName: wsName,
            workspaceLocation: wsData.location,
            color: b.color || '#999',
            actividad: b.actividad,
            activity: b.actividad,
            slots: slots,
            createdByUserId: b.userId || (b.createdBy && b.createdBy.userId) || null
          };
        });
      } catch (e) {
        bookings = [];
      }
    }

    // Auth helpers: determine login state and update UI accordingly
    async function checkLoginStatus() {
      try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const uname = data?.name || data?.username || 'Usuario';
          // Persist username for UI usage
          sessionStorage.setItem('username', uname);
          renderAuthUI(true, uname);
          return;
        }
      } catch (e) {
        // ignore and fallback to localStorage
      }
      const isLogged = localStorage.getItem('loggedIn') === 'true';
      // Clear stored username if not logged in
      if (!isLogged) sessionStorage.removeItem('username');
      renderAuthUI(isLogged, sessionStorage.getItem('username'));//'Usuario');
    }

    function renderAuthUI(loggedIn, username) {
      const userNameEl = document.getElementById('userName');
      const btnLogin = document.getElementById('btnLogin');
      const btnRegister = document.getElementById('btnRegister');
      const btnLogout = document.getElementById('btnLogout');
      const avatar = document.getElementById('avatar');

      // If logged in, prefer the username from sessionStorage if available
      const nameFromSession = typeof window !== 'undefined' ? sessionStorage.getItem('username') : null;
      const displayName = nameFromSession ? nameFromSession[0].toUpperCase() + nameFromSession.slice(1) : username || 'Usuario';

      if (loggedIn) {
        if (userNameEl) {
          // Show plain text with the user's name, not a button or pill
          userNameEl.textContent = displayName;
          userNameEl.style.display = 'inline';
          userNameEl.style.background = 'transparent';
          userNameEl.style.border = 'none';
          userNameEl.style.padding = '0';
          userNameEl.style.fontWeight = '600';
          userNameEl.style.color = 'var(--text-primary)';
        }
        if (btnLogin) btnLogin.style.display = 'none';
        if (btnRegister) btnRegister.style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'inline-block';
        if (avatar) {
          avatar.hidden = false;
          avatar.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z"/>
            </svg>`;
          avatar.style.display = 'inline-flex';
        }
      } else {
        if (userNameEl) {
          userNameEl.style.display = 'none';
        }
        if (btnLogin) btnLogin.style.display = 'inline-block';
        if (btnRegister) btnRegister.style.display = 'inline-block';
        if (btnLogout) btnLogout.style.display = 'none';
        if (avatar) { avatar.hidden = true; avatar.innerHTML = ''; }
      }
    }

    function renderCalendar() {
        // Render a 5-week calendar grid (35 days) with correct date mapping (local time)
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth(); // 0-11
        // Determine grid start: Sunday of the week that contains the 1st of the month (local time)
        const firstOfMonthLocal = new Date(year, month, 1);
        const startDowLocal = firstOfMonthLocal.getDay(); // 0 Sun
        const gridStart = new Date(year, month, 1 - startDowLocal);
        // console.log('year', year)
        // console.log('month', month);
        // console.log('firstOfMonthLocal', firstOfMonthLocal);
        // console.log('startDowLocal', startDowLocal);
        // console.log('gridStart', gridStart);

        // Build 5 weeks = 35 cells
        calendarGrid.innerHTML = '';
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        // Header should reflect the currently viewed month (not the gridStart month to avoid drift when the grid
        // includes days from the previous/next month)
        let displayMonth = monthNames[month];
        let displayYear = year;
        // console.log(`Rendering calendar for ${displayMonth} ${displayYear} starting on ${gridStart.toISOString().slice(0,10)}`);
        currentMonthEl.textContent = `${displayMonth} ${displayYear}`;

        for (let i = 0; i < 35; i++) {
            const t = gridStart.getTime() + i * 86400000;
            const d = new Date(t);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const dow = d.getDay();
            const isCurrentMonth = d.getMonth() === month;
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day' + (isCurrentMonth ? '' : ' other-month');
            dayEl.innerHTML = `<span class="day-number">${d.getDate()}</span>`;
            // Persist the date for click handling when selecting days
            dayEl.dataset.date = dateStr;
            // Mark activities for this date
            const activities = getFilteredActivities(dateStr, dow);
            if (activities.length > 0) {
                const dots = activities.slice(0, 4).map(act => `<span class="activity-dot" style="background: ${act.color}"></span>`).join('');
                dayEl.innerHTML += `<div class="day-dots">${dots}</div>`;
            }
            // Highlight today (local)
            const today = new Date();
            const todayStrLocal = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
            if (dateStr === todayStrLocal) dayEl.classList.add('today');
            dayEl.addEventListener('click', () => selectDay(d.getDate(), dateStr, activities));
            calendarGrid.appendChild(dayEl);
        }
    }

    function getFilteredActivities(dateStr, dayOfWeek) {
        const workspaceFilter = workspaceSelect.value;
        const activityFilter = activitySelect.value;
        const dayOfWeekFilter = dayFilter.value;

        // Map bookings into the same structure used by the UI rendering logic
        let filtered = bookings.flatMap(b =>
            b.slots
                .filter(slot => slot.date === dateStr)
                .map(slot => ({
                    ...b,
                    slot: slot
                }))
        );

        if (workspaceFilter) {
            filtered = filtered.filter(act => act.workspace === workspaceFilter);
        }

        if (activityFilter) {
            // activityFilter stores the activity id/name
            filtered = filtered.filter(act => act.actividad === activityFilter || act.activity === activityFilter);
        }

        if (dayOfWeekFilter !== '') {
            filtered = filtered.filter(act => dayOfWeek.toString() === dayOfWeekFilter);
        }

        // Normalize to expected keys in the template; ensure color is carried to top level for dots
        return filtered.map(item => ({
            ...item,
            activity: item.actividad,
            color: item.color || (item.slot && item.slot.color) || '#999'
        }));
    }

    function selectDay(day, dateStr, activities) {
        selectedDay = { day, dateStr };

        document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
        // Highlight the clicked date by selecting the element that has the matching data-date attribute
        const targetEl = document.querySelector(`.calendar-day[data-date='${dateStr}']`);
        if (targetEl) {
            targetEl.classList.add('selected');
        }

        const date = new Date(dateStr);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
        selectedDateEl.textContent = date.toLocaleDateString('es-AR', options);

        if (activities.length === 0) {
            dayActivitiesEl.innerHTML = '<p class="empty-day">No hay actividades reservadas</p>';
        } else {
            dayActivitiesEl.innerHTML = activities
            .sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime))
            .map(act => {
              // Determine edit permission for this booking turn
              const canEdit = (function() {
                let role = (sessionStorage.getItem('role') || 'visitor').toString().toLowerCase();
                const uid = String(sessionStorage.getItem('userId') || '');
                console.log('[BOOKING-UI] canEdit check', act?.id, 'role=', role, 'uid=', uid, 'createdBy=', act?.createdByUserId);
                if (role === 'admin') return true;
                if (role === 'instructor' && String(act.createdByUserId) === String(uid)) return true;
                return false;
              })();
              const editIcon = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L9 9l3.75 3.75 7-7z\"/></svg>`;
              const deleteIcon = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M3 6h18v2H3V6zm2 3h14l-1 12H6L5 9zm3-5h2l1-1h3l1 1h2v2H7V4z\"/></svg>`;
              const btns = canEdit
                  ? ` <button class=\"icon-btn edit\" onclick=\"handleEditClick('${act.id}')\" aria-label=\"Editar\" title=\"Editar\" style=\"border:0;background:transparent;padding:0;margin-left:6px;cursor:pointer;display:inline-flex;align-items:center;\">${editIcon}</button><button class=\"icon-btn delete\" onclick=\"handleDeleteClick('${act.id}')\" aria-label=\"Eliminar\" title=\"Eliminar\" style=\"border:0;background:transparent;padding:0;margin-left:6px;cursor:pointer;display:inline-flex;align-items:center;\">${deleteIcon}</button>`
                  : '';
              return `
                  <div class=\"activity-card\" data-id=\"${act.id}\" data-created-by-user-id=\"${act.createdByUserId ?? ''}\" style=\"border-left-color: ${act.color}\">
                      <div class=\"activity-header\">
                        ${act.activity}
                        <div class=\"card-actions\" style=\"margin-left:0;\">
                          ${btns}
                        </div>
                      </div>
                      <div class=\"activity-meta\">
                        <span class=\"activity-time\">${act.slot.startTime} - ${act.slot.endTime}</span>
                        <span class=\"activity-workspace\">${act.workspaceName}</span>
                      </div>
                  </div>
              `;
            }).join('');
        }
    }

    function populateActivitySelect() {
        const uniqueActivities = new Map();
        bookings.forEach(b => {
            if (!uniqueActivities.has(b.actividad)) {
                uniqueActivities.set(b.actividad, { id: b.actividad, activity: b.actividad, color: b.color });
            }
        });

        activitySelect.innerHTML = '<option value="">Todas las actividades</option>';
        uniqueActivities.forEach(act => {
            const option = document.createElement('option');
            option.value = act.id;
            option.textContent = act.activity;
            activitySelect.appendChild(option);
        });
    }

    function populateWorkspaceSelect() {
        // Populate creation select (resWorkspace)
        const resWorkspace = document.getElementById('resWorkspace');
        resWorkspace.innerHTML = '<option value="">Seleccionar espacio</option>';
        workspacesFromApi.forEach(ws => {
            const option = document.createElement('option');
            option.value = ws.id;
            option.textContent = ws.location ? `${ws.name} (${ws.location})` : ws.name;
            resWorkspace.appendChild(option);
        });

        // Populate filter select (workspaceSelect)
        const filterWorkspace = document.getElementById('workspaceSelect');
        if (filterWorkspace) {
          filterWorkspace.innerHTML = '<option value="">Todos los espacios</option>';
          workspacesFromApi.forEach(ws => {
            const opt = document.createElement('option');
            opt.value = ws.id;
            opt.textContent = ws.name;
            filterWorkspace.appendChild(opt);
          });
        }
    }

    // Delegation removed: use inline onclick handlers on buttons instead

    // Attach handlers to action buttons (Edit/Delete) safely (one-time)
    function attachCardActionHandlers() {
      document.querySelectorAll('.activity-card .card-action.edit').forEach(btn => {
        if (!btn.dataset.listener) {
          btn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            const bookingId = btn.closest('.activity-card')?.dataset?.id;
            if (!bookingId) return;
            try {
              const res = await fetch(`/bookings/${bookingId}`, { credentials: 'include' });
              if (!res.ok) return alert('No se pudo obtener la reserva');
              const booking = await res.json();
              showEditModal(booking);
            } catch (err) {
              console.error('Error fetching booking for edit', err);
            }
          });
          btn.dataset.listener = 'true';
        }
      });
      document.querySelectorAll('.activity-card .card-action.delete').forEach(btn => {
        if (!btn.dataset.listener) {
          btn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            const bookingId = btn.closest('.activity-card')?.dataset?.id;
            if (!bookingId) return;
            try {
              const res = await fetch(`/bookings/${bookingId}`, { method: 'DELETE', credentials: 'include' });
              if (res.ok) {
                await fetchBookingsFromApi();
                renderCalendar();
                populateActivitySelect();
                populateWorkspaceSelect();
                if (selectedDay && selectedDay.dateStr) {
                  const activities = getFilteredActivities(
                    selectedDay.dateStr,
                    new Date(selectedDay.dateStr).getDay()
                  );
                  selectDay(selectedDay.day, selectedDay.dateStr, activities);
                }
              } else {
                const err = await res.json();
                alert('Error al eliminar: ' + (err?.error || 'desconocido'));
              }
            } catch (err) {
              console.error('Error deleting booking', err);
            }
          });
          btn.dataset.listener = 'true';
        }
      });
    }

    function showEditModal(booking) {
        // Open modal and fill fields with booking data
        reservationModal.classList.remove('hidden');
        const header = document.querySelector('#reservationModal .modal-content h2');
        if (header) header.textContent = 'Editar Reserva';
        // Ensure the submit button reflects edit mode
        const submitBtn = document.querySelector('#reservationModal .modal-content button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Guardar';
        console.log('[BOOKING EDIT] loading booking', booking);
        document.getElementById('resWorkspace').value = booking.workspaceId || '';
        document.getElementById('resActivity').value = booking.actividad || '';
        document.getElementById('resColor').value = booking.color || '#3B82F6';
        document.getElementById('resStartDate').value = booking.startDate || '';
        document.getElementById('resEndDate').value = booking.endDate || '';
        document.getElementById('resStartTime').value = booking.startTime || '';
        document.getElementById('resEndTime').value = booking.endTime || '';
        // set days checkboxes
        document.querySelectorAll('input[name="days"]').forEach(cb => cb.checked = false);
        if (Array.isArray(booking.days)) {
            booking.days.forEach(d => {
                const el = document.querySelector(`input[name="days"][value="${d}"]`);
                if (el) el.checked = true;
            });
        }
        const rawId = booking._id || booking.id || '';
        const editId = typeof rawId === 'object' && rawId !== null && typeof rawId.toString === 'function'
          ? rawId.toString()
          : String(rawId);
        reservationForm.dataset.editId = editId;
        console.log('[BOOKING EDIT] set editId', editId);
    }

    // Global handlers for inline onclick actions (used by inline onclick in buttons)
    window.handleEditClick = async function(bookingId) {
      if (!bookingId) return;
      try {
        const res = await fetch(`/bookings/${bookingId}`, { credentials: 'include' });
        if (!res.ok) { alert('No se pudo obtener la reserva'); return; }
        const booking = await res.json();
        showEditModal(booking);
      } catch (err) {
        console.error('Error fetching booking for edit (handleEditClick)', err);
      }
    };
    window.handleDeleteClick = async function(bookingId) {
      if (!bookingId) return;
      if (!confirm('¿Seguro que quieres eliminar esta reserva?')) return;
      try {
        const res = await fetch(`/bookings/${bookingId}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
          await fetchBookingsFromApi();
          renderCalendar();
          populateActivitySelect();
          populateWorkspaceSelect();
          // Actualizar aside si hay fecha seleccionada
          if (selectedDay && selectedDay.dateStr) {
            const activities = getFilteredActivities(
              selectedDay.dateStr,
              new Date(selectedDay.dateStr).getDay()
            );
            selectDay(selectedDay.day, selectedDay.dateStr, activities);
          }
        } else {
          const err = await res.json();
          alert('Error al eliminar: ' + (err?.error || 'desconocido'));
        }
      } catch (err) {
        console.error('Error deleting booking (handleDeleteClick)', err);
      }
    };

    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    [workspaceSelect, activitySelect, dayFilter].forEach(select => {
        select.addEventListener('change', renderCalendar);
    });

    btnNewReservation.addEventListener('click', () => {
        reservationModal.classList.remove('hidden');
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('resStartDate').value = today;
        document.getElementById('resEndDate').value = today;

        // Ensure a color input exists for choosing reservation color
        let colorInput = document.getElementById('resColor');
        if (!colorInput) {
          colorInput = document.createElement('input');
          colorInput.id = 'resColor';
          colorInput.type = 'color';
          colorInput.value = '#ff0000'; // default rojo
          // Try to append near the date/time controls if possible
          reservationForm.appendChild(colorInput);
        }
    });

    closeModalBtn.addEventListener('click', () => {
        reservationModal.classList.add('hidden');
    });

    reservationModal.addEventListener('click', (e) => {
        if (e.target === reservationModal) {
            reservationModal.classList.add('hidden');
        }
    });

    reservationForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // If we are editing an existing booking, use PUT /bookings/:id
        if (reservationForm.dataset.editId) {
            const id = reservationForm.dataset.editId;
            const selectedDays = Array.from(document.querySelectorAll('input[name="days"]:checked'))
                .map(cb => parseInt(cb.value));
            if (selectedDays.length === 0) {
                alert('Selecciona al menos un día de la semana');
                return;
            }
            const payload = {
                workspaceId: document.getElementById('resWorkspace').value,
                startDate: document.getElementById('resStartDate').value,
                endDate: document.getElementById('resEndDate').value,
                startTime: document.getElementById('resStartTime').value,
                endTime: document.getElementById('resEndTime').value,
                days: selectedDays,
                color: document.getElementById('resColor')?.value,
                actividad: document.getElementById('resActivity').value,
                notes: ''
            };
            fetch(`/bookings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            }).then(async res => {
              let result;
              try { result = await res.json(); } catch (e) { result = null; }
              if (res.ok && result && (result._id || result.id)) {
                  reservationModal.classList.add('hidden');
                  reservationForm.reset();
                  delete reservationForm.dataset.editId;
                  // Refresh bookings view
                  fetchBookingsFromApi()
                    .then(() => {
                      renderCalendar();
                      populateActivitySelect();
                      populateWorkspaceSelect();
                      // Actualizar aside si hay fecha seleccionada
                      if (selectedDay && selectedDay.dateStr) {
                        const activities = getFilteredActivities(
                          selectedDay.dateStr,
                          new Date(selectedDay.dateStr).getDay()
                        );
                        selectDay(selectedDay.day, selectedDay.dateStr, activities);
                      }
                    })
                    .catch(err => console.error('Error refreshing after edit', err));
                } else {
                  const errMsg = (result && result.error) ? result.error : 'No se pudo guardar la reserva (posible problema de permisos)';
                  alert('Error: ' + errMsg);
                }
            }).catch(err => {
              alert('Error al guardar la reserva: ' + (err?.message || err));
            });
        } else {
            // Create new booking (existing flow)
            const selectedDays = Array.from(document.querySelectorAll('input[name="days"]:checked'))
                .map(cb => parseInt(cb.value));

            if (selectedDays.length === 0) {
                alert('Selecciona al menos un día de la semana');
                return;
            }

            // Build payload for API with recurrence (startDate..endDate) and days of week
            const startDate = document.getElementById('resStartDate').value || new Date().toISOString().split('T')[0];
            const endDate = document.getElementById('resEndDate').value || startDate;
            const daysSelected = Array.from(document.querySelectorAll('input[name="days"]:checked')).map(cb => parseInt(cb.value));
            const payload = {
                workspaceId: document.getElementById('resWorkspace').value,
                startDate,
                endDate,
                startTime: document.getElementById('resStartTime').value,
                endTime: document.getElementById('resEndTime').value,
                days: daysSelected,
                color: document.getElementById('resColor')?.value,
                actividad: document.getElementById('resActivity').value,
                notes: ''
            };

            // Prefer using a lightweight API wrapper if available
            let api = window.BookingsApi || {
              createBooking: (data) => fetch('/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
              }).then(res => res.json())
            };

            api.createBooking(payload).then(result => {
              if (result && (result._id || result.insertedId)) {
                alert('Reserva creada con éxito');
                reservationModal.classList.add('hidden');
                reservationForm.reset();
                // Auto-refresh bookings and UI to reflect the newly created reservation
                fetchBookingsFromApi()
                  .then(() => {
                    renderCalendar();
                    populateActivitySelect();
                    populateWorkspaceSelect();
                    if (selectedDay && selectedDay.dateStr) {
                      const activities = getFilteredActivities(
                        selectedDay.dateStr,
                        new Date(selectedDay.dateStr).getDay()
                      );
                      selectDay(selectedDay.day, selectedDay.dateStr, activities);
                    }
                  })
                  .catch(err => {
                    console.error('Error refreshing bookings after create', err);
                  });
            } else if (result && result.error) {
              // Creation errors can be surfaced as a generic message to avoid leaking backend specifics
              alert('Error al crear la reserva: ' + (result.error || 'Desconocido'));
              } else {
              alert('Error al crear la reserva');
            }
            }).catch(err => {
              alert('Error al crear: ' + (err?.message || err));
            });
        }
    });

    document.getElementById('btnLogin').addEventListener('click', async () => {
        // create login modal
        const modal = document.createElement('div');
        modal.id = 'loginModal';
        modal.className = 'modal';
        modal.innerHTML = `
          <div class="modal-content">
            <span class="modal-close" id="loginClose">&times;</span>
            <h2>Iniciar sesión</h2>
            <form id="loginForm" class="form-group" style="display:flex;flex-direction:column;gap:1rem;">
              <div class="form-group">
                <label>Email</label>
                <input id="loginEmail" placeholder="Email" type="email" required />
              </div>
              <div class="form-group">
                <label>Password</label>
                <input id="loginPassword" placeholder="Password" type="password" required />
                <button type="button" id="forgotPasswordBtn" style="background:none;border:none;color:#4A90D9;cursor:pointer;font-size:0.9em;margin-left:4px;text-decoration:underline;">¿Olvidaste tu contraseña?</button>
              </div>
              <button type="submit" class="btn-primary">Iniciar sesión</button>
            </form>
          </div>`;
        document.body.appendChild(modal);

        // close handlers
        document.getElementById('loginClose').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
        const payload = {
          email: document.getElementById('loginEmail').value,
          password: document.getElementById('loginPassword').value
        };

        try {
            const res = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                // alert('Login exitoso');
                sessionStorage.setItem('username', data.user?.name || 'Usuario');
                sessionStorage.setItem('role', data.user?.role || 'visitor');
                sessionStorage.setItem('userId', data.user?._id || data.user?.id || '');
                console.log('Login successful, user:', data.user);
                modal.remove();
                localStorage.setItem('loggedIn', 'true');
                await checkLoginStatus();
            } else {
                alert('Error: ' + (data.error || 'Credenciales inválidas'));
            }
        } catch (err) {
            alert('Error de login: ' + err);
        }
      });
    });

    // Forgot password modal
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'forgotPasswordBtn') {
        e.preventDefault();
        const loginModal = document.getElementById('loginModal');
        if (loginModal) loginModal.remove();
        createForgotPasswordModal();
      }
    });

    function createForgotPasswordModal() {
      const modal = document.createElement('div');
      modal.id = 'forgotPasswordModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <span class="modal-close" id="forgotClose">&times;</span>
          <h2>Recuperar Contraseña</h2>
          <p style="color:#666;margin-bottom:1rem;">Ingresa tu email y recibirás un enlace para cambiar tu contraseña.</p>
          <form id="forgotForm" class="form-group" style="display:flex;flex-direction:column;gap:1rem;">
            <div class="form-group">
              <label>Email</label>
              <input id="forgotEmail" placeholder="tu@email.com" type="email" required />
            </div>
            <button type="submit" class="btn-primary">Enviar enlace</button>
          </form>
        </div>`;
      document.body.appendChild(modal);

      document.getElementById('forgotClose').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      document.getElementById('forgotForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgotEmail').value;
        try {
          const res = await fetch('/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (res.ok) {
            alert('Si el correo existe, recibirás instrucciones.');
            modal.remove();
          } else {
            alert('Error: ' + (data.error || 'Intenta de nuevo'));
          }
        } catch (err) {
          alert('Error: ' + err);
        }
      });
    }

    // Logout button handling
    const btnLogoutEl = document.getElementById('btnLogout');
    if (btnLogoutEl) {
      btnLogoutEl.addEventListener('click', async () => {
        try {
          await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (e) {
          // ignore
        }
        localStorage.setItem('loggedIn', 'false');
        // Clear session and UI state
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('userId');
        // Clear UI cards and details view
        const dayActivitiesEl = document.getElementById('dayActivities');
        if (dayActivitiesEl) dayActivitiesEl.innerHTML = '';
        const selectedDateEl = document.getElementById('selectedDate');
        if (selectedDateEl) selectedDateEl.textContent = '';
        const calendarGrid = document.getElementById('calendarGrid');
        if (calendarGrid) calendarGrid.innerHTML = '';
        await checkLoginStatus();
        fetchBookingsFromApi()
          .then(() => {
            renderCalendar();
            populateActivitySelect();
            populateWorkspaceSelect();
            if (selectedDay && selectedDay.dateStr) {
              const activities = getFilteredActivities(
                selectedDay.dateStr,
                new Date(selectedDay.dateStr).getDay()
              );
              selectDay(selectedDay.day, selectedDay.dateStr, activities);
            }
          })
          .catch(err => console.error('Error refreshing after edit', err));
      });
    }

    // Registrar nuevo usuario: modal estilizado coherente
    function createRegisterModal() {
      const modal = document.createElement('div');
      modal.id = 'registerModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <span class="modal-close" id="registerClose">&times;</span>
          <h2>Registrar usuario</h2>
          <form id="registerForm" class="form-group" style="display:flex;flex-direction:column;gap:1rem;">
            <div class="form-group">
              <label>Nombre</label>
              <input id="regName" placeholder="Nombre" required />
            </div>
            <div class="form-group">
              <label>Apellido</label>
              <input id="regSurname" placeholder="Apellido" required />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input id="regEmail" placeholder="Email" type="email" required />
            </div>
            <div class="form-group">
              <label>Password</label>
              <input id="regPassword" placeholder="Password" type="password" required />
            </div>
            <button type="submit" class="btn-primary">Registrar</button>
          </form>
        </div>`;
      document.body.appendChild(modal);

      // close handlers
      document.getElementById('registerClose').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('regName').value,
          surname: document.getElementById('regSurname').value,
          email: document.getElementById('regEmail').value,
          password: document.getElementById('regPassword').value
        };
        try {
          const res = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (res.ok) {
            alert('Registro exitoso');
            modal.remove();
            // localStorage.setItem('loggedIn', 'true');
            // await checkLoginStatus();
          } else {
            alert('Error: ' + (data.error || 'No se pudo registrar'));
          }
        } catch (err) {
          alert('Error al registrar: ' + err);
        }
      });
    }

    // Expose for external triggers
    window.showRegisterModal = createRegisterModal;
    // Registrar botón en navbar
    function ensureRegisterButton() {
      let regBtn = document.getElementById('btnRegister');
      if (!regBtn) {
        regBtn = document.createElement('button');
        regBtn.id = 'btnRegister';
        regBtn.textContent = 'Registrarse';
        regBtn.className = 'btn-secondary';
        // Append at the end of the navbar-user container
        document.getElementById('authArea').appendChild(regBtn);
      }
      regBtn.addEventListener('click', () => {
        createRegisterModal();
      });
    }
    ensureRegisterButton();

    // Load workspaces first to populate the creation filters, then bookings
    fetchWorkspacesFromApi()
      .then(fetchBookingsFromApi)
      .then(() => {
        renderCalendar();
        populateActivitySelect();
        populateWorkspaceSelect();
        // Determine initial auth state after data loads
        checkLoginStatus();
      });
});

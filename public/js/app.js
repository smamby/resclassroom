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
        workspacesFromApi = data.map(ws => ({ id: ws.id || ws._id, name: ws.name }));
        // Build a lookup map by id
        workspacesFromApi.forEach(ws => { workspacesById[ws.id] = ws.name; });
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
          const wsName = workspacesById[wsId] || b.workspaceName || wsId;
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
            id: b._id || b.id,
            workspace: wsId,
            workspaceName: wsName,
            color: b.color || '#999',
            actividad: b.actividad,
            activity: b.actividad,
            slots: slots
          };
        });
      } catch (e) {
        bookings = [];
      }
    }

    function renderCalendar() {
        // Render a 5-week calendar grid (35 days) with correct date mapping
        const year = currentDate.getUTCFullYear();
        const month = currentDate.getUTCMonth(); // 0-11
        // Determine grid start: Sunday of the week that contains the 1st of the month (UTC)
        const firstOfMonth = new Date(Date.UTC(year, month, 1));
        const startDow = firstOfMonth.getUTCDay(); // 0 Sun
        const gridStart = new Date(Date.UTC(year, month, 1 - startDow));

        // Build 5 weeks = 35 cells
        calendarGrid.innerHTML = '';
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const displayMonth = monthNames[gridStart.getUTCMonth()];
        const displayYear = gridStart.getUTCFullYear();
        currentMonthEl.textContent = `${displayMonth} ${displayYear}`;

        for (let i = 0; i < 35; i++) {
            const t = gridStart.getTime() + i * 86400000;
            const d = new Date(t);
            const dateStr = d.toISOString().slice(0, 10);
            const dow = d.getUTCDay();
            const isCurrentMonth = d.getUTCMonth() === month;
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day' + (isCurrentMonth ? '' : ' other-month');
            dayEl.innerHTML = `<span class="day-number">${d.getUTCDate()}</span>`;
            // Mark activities for this date
            const activities = getFilteredActivities(dateStr, dow);
            if (activities.length > 0) {
                const dots = activities.slice(0, 4).map(act => `<span class="activity-dot" style="background: ${act.color}"></span>`).join('');
                dayEl.innerHTML += `<div class="day-dots">${dots}</div>`;
            }
            // Highlight today
            const today = new Date();
            const todayStr = today.toUTCString().slice(0, 16).replace(',', ''); // approximate safe check
            if (dateStr === today.toISOString().slice(0,10)) dayEl.classList.add('today');

            dayEl.addEventListener('click', () => selectDay(d.getUTCDate(), dateStr, activities));
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
        const days = document.querySelectorAll('.calendar-day:not(.other-month)');
        const dayIndex = Array.from(days).findIndex(el =>
            el.querySelector('.day-number')?.textContent == day && !el.classList.contains('other-month')
        );

        const allDays = document.querySelectorAll('.calendar-day');
        const today = new Date();
        const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
        const targetIndex = startDay + day - 1;

        if (targetIndex < allDays.length) {
            allDays[targetIndex].classList.add('selected');
        }

        const date = new Date(dateStr);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        selectedDateEl.textContent = date.toLocaleDateString('es-ES', options);

        if (activities.length === 0) {
            dayActivitiesEl.innerHTML = '<p class="empty-day">No hay actividades reservadas</p>';
        } else {
            dayActivitiesEl.innerHTML = activities.map(act => `
                <div class="activity-card" style="border-left-color: ${act.color}">
                    <h4>${act.activity}</h4>
                    <p class="activity-time">${act.slot.startTime} - ${act.slot.endTime}</p>
                    <p class="activity-workspace">${act.workspaceName}</p>
                </div>
            `).join('');
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
            option.textContent = ws.name;
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
          } else if (result && result.error) {
            alert('Error: ' + result.error);
          } else {
            alert('Error al crear la reserva');
          }
        }).catch(err => {
          alert('Error al crear la reserva: ' + (err?.message || err));
        });
    });

    document.getElementById('btnLogin').addEventListener('click', async () => {
        const email = prompt('Email:')?.trim();
        if (!email) return;
        const password = prompt('Password:')?.trim();
        if (!password) return;
        try {
            const res = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                alert('Login exitoso');
                localStorage.setItem('loggedIn', 'true');
                location.reload();
            } else {
                alert('Error: ' + (data.error || 'Credenciales inválidas'));
            }
        } catch (err) {
            alert('Error de login: ' + err);
        }
    });

    // Registrar nuevo usuario: muestra un modal simple de registro
    function createRegisterModal() {
      const modal = document.createElement('div');
      modal.id = 'registerModal';
      modal.style.position = 'fixed';
      modal.style.top = '0'; modal.style.left = '0'; modal.style.right = '0'; modal.style.bottom = '0';
      modal.style.background = 'rgba(0,0,0,0.5)';
      modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center';
      modal.style.zIndex = '1000';
      modal.innerHTML = `
        <div style="background:white;padding:20px;border-radius:8px;min-width:300px;">
          <h3>Registrar usuario</h3>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <input id="regName" placeholder="Nombre" />
            <input id="regSurname" placeholder="Apellido" />
            <input id="regEmail" placeholder="Email" />
            <input id="regPassword" placeholder="Password" type="password" />
          </div>
          <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
            <button id="regCancel">Cancelar</button>
            <button id="regSubmit">Registrar</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      document.getElementById('regCancel').addEventListener('click', () => {
        modal.remove();
      });
      document.getElementById('regSubmit').addEventListener('click', async () => {
        const name = document.getElementById('regName').value;
        const surname = document.getElementById('regSurname').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const payload = { name, surname, email, password };
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
            location.reload();
          } else {
            alert('Error: ' + (data.error || 'No se pudo registrar'));
          }
        } catch (err) {
          alert('Error al registrar: ' + err);
        }
      });
    }

    window.showRegisterModal = createRegisterModal;
    // Ensure a Registrarse button exists in the navbar-user; if not, create it
    function ensureRegisterButton() {
      let regBtn = document.getElementById('btnRegister');
      if (!regBtn) {
        regBtn = document.createElement('button');
        regBtn.id = 'btnRegister';
        regBtn.textContent = 'Registrarse';
        // Try to append to a navbar-user container if present
        const navbarUser = document.getElementsByClassName('navbar-user')[0] || document.body;
        navbarUser.appendChild(regBtn);
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
      });
});

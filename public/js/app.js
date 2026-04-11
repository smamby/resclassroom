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
            .map(act => `
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
            // Auto-refresh bookings and UI to reflect the newly created reservation
            fetchBookingsFromApi()
              .then(() => {
                renderCalendar();
                populateActivitySelect();
                populateWorkspaceSelect();
              })
              .catch(err => {
                console.error('Error refreshing bookings after create', err);
              });
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
        // const email = prompt('Email:')?.trim();
        // if (!email) return;
        // const password = prompt('Password:')?.trim();
        // if (!password) return;

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
        sessionStorage.removeItem('username');
        await checkLoginStatus();
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

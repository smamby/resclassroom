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
        workspacesFromApi = data.map(ws => ({ id: ws._id || ws.id, name: ws.name }));
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
          return {
            id: b._id || b.id,
            workspace: wsId,
            workspaceName: wsName,
            color: '#999',
            actividad: b.actividad,
            activity: b.actividad,
            slots: [{ date: b.date, startTime: b.startTime, endTime: b.endTime }]
          };
        });
      } catch (e) {
        bookings = [];
      }
    }

    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        currentMonthEl.textContent = `${monthNames[month]} ${year}`;
        
        calendarGrid.innerHTML = '';
        
        const prevMonth = new Date(year, month, 0);
        for (let i = startDay - 1; i >= 0; i--) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day other-month';
            dayEl.innerHTML = `<span class="day-number">${prevMonth.getDate() - i}</span>`;
            calendarGrid.appendChild(dayEl);
        }
        
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, month, day).getDay();
            
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            
            if (dateStr === todayStr) {
                dayEl.classList.add('today');
            }
            
        const dayActivities = getFilteredActivities(dateStr, dayOfWeek);
            
            if (dayActivities.length > 0) {
                const dots = dayActivities.slice(0, 4).map(act => 
                    `<span class="activity-dot" style="background: ${act.color}"></span>`
                ).join('');
                dayEl.innerHTML = `
                    <span class="day-number">${day}</span>
                    <div class="day-dots">${dots}</div>
                `;
            } else {
                dayEl.innerHTML = `<span class="day-number">${day}</span>`;
            }
            
            dayEl.addEventListener('click', () => selectDay(day, dateStr, dayActivities));
            calendarGrid.appendChild(dayEl);
        }
        
        const totalCells = startDay + daysInMonth;
        const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remainingCells; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day other-month';
            dayEl.innerHTML = `<span class="day-number">${i}</span>`;
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
        
        // Normalize to expected keys in the template
        return filtered.map(item => ({
            ...item,
            activity: item.actividad
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
        
        // Build payload for API (single date based on resStartDate as a simplified approach)
        const dateValue = document.getElementById('resStartDate')?.value || new Date().toISOString().split('T')[0];
        const payload = {
            workspaceId: document.getElementById('resWorkspace').value,
            date: dateValue,
            startTime: document.getElementById('resStartTime').value,
            endTime: document.getElementById('resEndTime').value,
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

    document.getElementById('btnLogin').addEventListener('click', () => {
        alert('Login con JWT vendrá pronto');
    });

    // Load workspaces first to populate the creation filters, then bookings
    fetchWorkspacesFromApi()
      .then(fetchBookingsFromApi)
      .then(() => {
        renderCalendar();
        populateActivitySelect();
        populateWorkspaceSelect();
      });
});

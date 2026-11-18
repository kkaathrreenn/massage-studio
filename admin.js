(() => {
  const TIMES = ['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','20:30'];
  const client = window.createStudioSupabase?.();
  const $ = id => document.getElementById(id);
  const loginPanel = $('login-panel'), content = $('admin-content');
  const loginForm = $('login-form'), loginMessage = $('login-message');
  const scheduleMessage = $('schedule-message'), calendar = $('schedule-calendar');
  const monthLabel = $('month-label');
  let month = new Date(); month.setDate(1); month.setHours(12,0,0,0);
  let working = {}; let baseline = {}; let saving = false;
  const pad = n => String(n).padStart(2,'0');
  const isoDay = (year, monthIndex, day) => `${year}-${pad(monthIndex+1)}-${pad(day)}`;
  const daysInMonth = d => new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  const monthName = d => new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d);
  const dirty = () => JSON.stringify(working) !== JSON.stringify(baseline);
  function message(el, text, type='') { el.textContent = text; el.className = `form-message ${type}`.trim(); }
  function setLoggedIn(isIn) { loginPanel.hidden = isIn; content.hidden = !isIn; $('logout-button').hidden = !isIn; }

  async function init() {
    if (!client) { message(loginMessage, 'Сначала заполните URL и публичный ключ Supabase в supabase.js.', 'error'); return; }
    const { data: { session } } = await client.auth.getSession();
    if (session) await showAdmin();
    client.auth.onAuthStateChange((_event, sessionNow) => { if (!sessionNow) setLoggedIn(false); });
  }
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!client) return;
    message(loginMessage, 'Выполняется вход…');
    const { error } = await client.auth.signInWithPassword({ email: $('login-email').value.trim(), password: $('login-password').value });
    if (error) { message(loginMessage, error.message, 'error'); return; }
    await showAdmin();
  });
  $('logout-button').addEventListener('click', async () => { if (dirty() && !confirm('Есть несохранённые изменения. Выйти без сохранения?')) return; await client.auth.signOut(); setLoggedIn(false); });

  async function showAdmin() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) { setLoggedIn(false); return; }
    // Проверка членства в списке администраторов; RLS остаётся обязательной серверной защитой.
    const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error || !data) { await client.auth.signOut(); setLoggedIn(false); message(loginMessage, 'У этой учётной записи нет прав администратора.', 'error'); return; }
    setLoggedIn(true);
    await loadMonth();
  }

  function monthDates() { const count = daysInMonth(month); return Array.from({length: count}, (_,i) => isoDay(month.getFullYear(), month.getMonth(), i+1)); }
  async function loadMonth() {
    const dates = monthDates(); monthLabel.textContent = monthName(month).replace(/^./, c => c.toLocaleUpperCase('ru-RU'));
    message(scheduleMessage, 'Загрузка сохранённого расписания…');
    const { data, error } = await client.from('schedule_days').select('day,available_slots').gte('day', dates[0]).lte('day', dates[dates.length-1]);
    if (error) { message(scheduleMessage, `Не удалось загрузить расписание: ${error.message}`, 'error'); return; }
    working = {}; (data || []).forEach(row => { working[row.day] = Array.isArray(row.available_slots) ? row.available_slots : []; });
    dates.forEach(day => { if (!working[day]) working[day] = []; });
    baseline = JSON.parse(JSON.stringify(working));
    renderCalendar(); message(scheduleMessage, 'Все изменения сохранены.');
  }
  function renderCalendar() {
    const dates = monthDates();
    const fragment = document.createDocumentFragment();
    const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    weekdayNames.forEach(name => {
      const weekday = document.createElement('div');
      weekday.className = 'calendar-weekday';
      weekday.textContent = name;
      fragment.append(weekday);
    });

    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < mondayOffset; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-empty';
      empty.setAttribute('aria-hidden', 'true');
      fragment.append(empty);
    }

    const today = new Date();
    const todayKey = isoDay(today.getFullYear(), today.getMonth(), today.getDate());

    dates.forEach(day => {
      const [year, monthNumber, dayNumber] = day.split('-').map(Number);
      const date = new Date(year, monthNumber - 1, dayNumber, 12);
      const card = document.createElement('section');
      card.className = 'calendar-day';
      if (day === todayKey) card.classList.add('is-today');

      const header = document.createElement('div');
      header.className = 'calendar-day-header';
      const dateNumber = document.createElement('strong');
      dateNumber.className = 'calendar-day-number';
      dateNumber.textContent = pad(dayNumber);
      const weekday = document.createElement('span');
      weekday.className = 'calendar-day-name';
      weekday.textContent = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date).replace('.', '');
      const selectedCount = document.createElement('span');
      selectedCount.className = 'calendar-day-count';
      selectedCount.textContent = `${(working[day] || []).length}/${TIMES.length}`;
      selectedCount.setAttribute('aria-label', 'Количество свободных слотов');
      header.append(dateNumber, weekday, selectedCount);
      card.append(header);

      const slots = document.createElement('div');
      slots.className = 'calendar-day-slots';
      TIMES.forEach(time => {
        const label = document.createElement('label');
        label.className = 'calendar-slot';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = (working[day] || []).includes(time);
        cb.setAttribute('aria-label', `${day}, ${time}: свободно`);
        const timeText = document.createElement('span');
        timeText.textContent = time;
        cb.addEventListener('change', () => {
          const values = new Set(working[day] || []);
          if (cb.checked) values.add(time); else values.delete(time);
          working[day] = TIMES.filter(t => values.has(t));
          selectedCount.textContent = `${working[day].length}/${TIMES.length}`;
          message(scheduleMessage, dirty() ? 'Есть несохранённые изменения.' : 'Все изменения сохранены.', dirty() ? '' : 'success');
        });
        label.append(cb, timeText);
        slots.append(label);
      });
      card.append(slots);
      fragment.append(card);
    });

    calendar.replaceChildren(fragment);
  }
  async function changeMonth(delta) {
    if (dirty() && !confirm('Есть несохранённые изменения. Переключить месяц и отменить их?')) return;
    month.setMonth(month.getMonth()+delta); await loadMonth();
  }
  $('previous-month').addEventListener('click', () => changeMonth(-1));
  $('next-month').addEventListener('click', () => changeMonth(1));
  $('save-schedule').addEventListener('click', async () => {
    if (saving || !dirty()) return;
    saving = true; $('save-schedule').disabled = true; message(scheduleMessage, 'Сохранение…');
    try {
      const payload = monthDates().map(day => ({ day, available_slots: working[day] || [] }));
      const { error } = await client.from('schedule_days').upsert(payload, { onConflict: 'day' });
      if (error) throw error;
      baseline = JSON.parse(JSON.stringify(working));
      message(scheduleMessage, 'Изменения успешно сохранены и опубликованы.', 'success');
    } catch (e) { console.error(e); message(scheduleMessage, `Ошибка сохранения: ${e.message}`, 'error'); }
    finally { saving = false; $('save-schedule').disabled = false; }
  });
  window.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

  init();
})();

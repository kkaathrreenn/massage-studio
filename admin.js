(() => {
  const TIMES = ['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','20:30'];
  const client = window.createStudioSupabase?.();
  const $ = id => document.getElementById(id);
  const loginPanel = $('login-panel'), content = $('admin-content');
  const loginForm = $('login-form'), loginMessage = $('login-message');
  const scheduleMessage = $('schedule-message'), table = $('schedule-table');
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
    renderTable(); message(scheduleMessage, 'Все изменения сохранены.');
  }
  function renderTable() {
    const dates = monthDates();
    const thead = document.createElement('thead'); const headRow = document.createElement('tr');
    const dateTh = document.createElement('th'); dateTh.textContent = 'Дата'; headRow.append(dateTh);
    TIMES.forEach(time => { const th = document.createElement('th'); th.textContent = time; headRow.append(th); });
    thead.append(headRow);
    const tbody = document.createElement('tbody');
    dates.forEach(day => {
      const tr = document.createElement('tr'); const dateTd = document.createElement('td');
      const [y,m,d] = day.split('-').map(Number); const dayDate = new Date(y,m-1,d,12);
      dateTd.textContent = `${pad(d)}.${pad(m)} · ${new Intl.DateTimeFormat('ru-RU',{weekday:'short'}).format(dayDate)}`; tr.append(dateTd);
      TIMES.forEach(time => {
        const td = document.createElement('td'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = (working[day] || []).includes(time);
        cb.setAttribute('aria-label', `${day}, ${time}: свободно`);
        cb.addEventListener('change', () => {
          const values = new Set(working[day] || []);
          if (cb.checked) values.add(time); else values.delete(time);
          working[day] = TIMES.filter(t => values.has(t));
          message(scheduleMessage, dirty() ? 'Есть несохранённые изменения.' : 'Все изменения сохранены.', dirty() ? '' : 'success');
        });
        td.append(cb); tr.append(td);
      }); tbody.append(tr);
    });
    table.replaceChildren(thead, tbody);
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

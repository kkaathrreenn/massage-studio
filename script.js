(() => {
  const TIMES = ['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','20:30'];
  const client = window.createStudioSupabase?.();
  const card = document.querySelector('.schedule-card');
  const dateEl = document.getElementById('selected-date');
  const weekdayEl = document.getElementById('weekday');
  const grid = document.getElementById('slots-grid');
  const errorEl = document.getElementById('schedule-error');
  let selected = new Date();
  selected.setHours(12,0,0,0);
  let currentChannel = null;
  const pad = n => String(n).padStart(2,'0');
  const keyFor = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const formatDate = d => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
  const weekday = d => new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(d);

  function renderDate() {
    dateEl.textContent = formatDate(selected);
    weekdayEl.textContent = weekday(selected).charAt(0).toUpperCase() + weekday(selected).slice(1);
  }
  function renderSlots(available = []) {
    grid.innerHTML = '';
    const left = document.createElement('div'); left.className = 'slot-column';
    const right = document.createElement('div'); right.className = 'slot-column';
    TIMES.slice(0,5).forEach(t => left.append(makeSlot(t, available.includes(t))));
    TIMES.slice(5).forEach(t => right.append(makeSlot(t, available.includes(t))));
    grid.append(left, right);
  }
  function makeSlot(time, isFree) {
    const el = document.createElement('div');
    el.className = `time-slot${isFree ? '' : ' is-busy'}`;
    el.textContent = time;
    el.setAttribute('aria-label', `${time}: ${isFree ? 'свободно' : 'занято'}`);
    return el;
  }
  async function loadSchedule() {
    const day = keyFor(selected);
    renderDate(); errorEl.hidden = true; card.classList.add('is-changing');
    if (!client) {
      renderSlots([]); errorEl.hidden = false;
      errorEl.textContent = 'Подключите Supabase: укажите URL проекта и публичный ключ в supabase.js.';
      card.classList.remove('is-changing'); return;
    }
    try {
      const { data, error } = await client.from('schedule_days').select('available_slots').eq('day', day).maybeSingle();
      if (error) throw error;
      renderSlots(data?.available_slots || []);
      subscribeToDay(day);
    } catch (err) {
      console.error('Schedule loading failed:', err);
      renderSlots([]); errorEl.hidden = false;
      errorEl.textContent = 'Не удалось загрузить расписание. Проверьте подключение и попробуйте позже.';
    } finally { card.classList.remove('is-changing'); }
  }
  function subscribeToDay(day) {
    if (!client) return;
    if (currentChannel) client.removeChannel(currentChannel);
    currentChannel = client.channel(`public-schedule-${day}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_days', filter: `day=eq.${day}` }, () => loadSchedule())
      .subscribe();
  }
  function shiftDate(amount) {
    selected.setDate(selected.getDate() + amount);
    loadSchedule();
  }
  document.getElementById('previous-day').addEventListener('click', () => shiftDate(-1));
  document.getElementById('next-day').addEventListener('click', () => shiftDate(1));

  loadSchedule();
  // Realtime — основной механизм обновления; периодическая проверка служит резервом.
  setInterval(() => loadSchedule(), 60000);
})();

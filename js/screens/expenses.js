// Экран трат: список за месяц с фильтрами. Адрес: #/expenses или #/expenses/2026-12
(function () {
  // Фильтры и вид живут, пока открыто приложение (главный экран может выставить категорию)
  const filter = App.expensesFilter = { period: 'all', categoryId: 'all', view: 'days' };
  const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
    'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function dayTitle(s) {
    const d = App.budget.parse(s);
    const today = App.utils.isoDate();
    const yesterday = App.budget.addDays(today, -1);
    const prefix = s === today ? 'Сегодня, ' : s === yesterday ? 'Вчера, ' : '';
    return prefix + d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + (prefix ? '' : ', ' + WEEKDAYS[d.getDay()]);
  }

  App.router.register('expenses', {
    title: 'Траты',
    render(el, params) {
      const { money, esc } = App.utils;
      const B = App.budget;
      const key = App.ui.monthFromParams(params);
      const data = App.store.get();
      const catById = {};
      data.categories.forEach(c => { catById[c.id] = c; });

      const all = B.expensesOf(key);
      const list = all
        .filter(e => filter.period === 'all' || B.expensePeriod(e) === filter.period)
        .filter(e => filter.categoryId === 'all' || e.categoryId === filter.categoryId)
        .sort((a, b) => b.date.localeCompare(a.date) || 0);
      const total = list.reduce((s, e) => s + e.amount, 0);

      // Группируем по дням
      const groups = [];
      list.forEach(e => {
        const last = groups[groups.length - 1];
        if (last && last.date === e.date) last.items.push(e);
        else groups.push({ date: e.date, items: [e] });
      });

      const periodTitle = t => B.TYPES[t];
      const rows = groups.map(g => `
        <div class="day-group">
          <div class="day-head small">
            <span>${dayTitle(g.date)}</span>
            <span>${money(g.items.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          <div class="card list-card">
            <ul class="list">
              ${g.items.map(e => {
                const c = catById[e.categoryId] || { name: 'Без категории', icon: '❔', color: '#475569' };
                return `
                  <li><button class="list-row list-btn" data-exp="${e.id}">
                    <span class="cat-icon sm" style="background:${c.color}1f">${c.icon}</span>
                    <span class="row-main">
                      <span class="row-title">${esc(c.name)}</span>
                      <span class="small muted">${e.comment ? esc(e.comment) + ' · ' : ''}${periodTitle(B.expensePeriod(e))}${e.recurringKey ? ' · 🔁' : e.periodManual ? ' ✎' : ''}</span>
                    </span>
                    <span class="amount-neg">−${money(e.amount)}</span>
                  </button></li>`;
              }).join('')}
            </ul>
          </div>
        </div>`).join('');

      // Вид «По категориям»: итог по каждой категории и её траты
      const byCat = {};
      list.forEach(e => { (byCat[e.categoryId] = byCat[e.categoryId] || []).push(e); });
      const catGroups = Object.keys(byCat).map(id => ({
        c: catById[id] || { id, name: 'Без категории', icon: '❔', color: '#475569' },
        items: byCat[id],
        total: byCat[id].reduce((s, e) => s + e.amount, 0)
      })).sort((a, b) => b.total - a.total);
      const limitOf = id => (filter.period === 'all'
        ? B.periods(key).reduce((s, p) => s + B.limitFor(key, id, p.type), 0)
        : B.limitFor(key, id, filter.period));
      const catRows = catGroups.map(g => {
        const limit = g.c.archived ? 0 : limitOf(g.c.id);
        const status = B.limitStatus(g.total, limit);
        const pct = limit > 0 ? Math.min(100, Math.round(g.total / limit * 100)) : 0;
        return `
        <div class="card cat-group">
          <div class="cat-head">
            <span class="cat-icon" style="background:${g.c.color}1f">${g.c.icon}</span>
            <span class="row-main">
              <span class="cat-name">${esc(g.c.name)}</span>
              <span class="small muted">${g.items.length} ${g.items.length === 1 ? 'трата' : g.items.length < 5 ? 'траты' : 'трат'}${limit ? ' · лимит ' + money(limit) : ''}</span>
            </span>
            <b class="st-${status}-text">${money(g.total)}</b>
          </div>
          ${limit ? `<div class="progress thin"><div class="bar-${status}" style="width:${pct}%"></div></div>` : ''}
          <ul class="list">
            ${g.items.map(e => `
              <li><button class="list-row list-btn" data-exp="${e.id}">
                <span class="row-main">
                  <span class="row-title">${e.comment ? esc(e.comment) : '<span class="muted">Без комментария</span>'}</span>
                  <span class="small muted">${App.budget.shortDate(e.date)} · ${periodTitle(B.expensePeriod(e))}${e.recurringKey ? ' · 🔁' : ''}</span>
                </span>
                <span class="amount-neg">−${money(e.amount)}</span>
              </button></li>`).join('')}
          </ul>
        </div>`;
      }).join('');

      const usedCats = data.categories.filter(c => !c.archived || all.some(e => e.categoryId === c.id));

      el.innerHTML = `
        ${App.ui.monthSwitch('expenses', key)}

        <div class="segmented two view-switch" role="radiogroup" aria-label="Вид">
          <label><input type="radio" name="view" value="days" ${filter.view === 'days' ? 'checked' : ''}><span>По дням</span></label>
          <label><input type="radio" name="view" value="cats" ${filter.view === 'cats' ? 'checked' : ''}><span>По категориям</span></label>
        </div>

        <div class="filters">
          <div class="chips" role="group" aria-label="Период">
            ${[['all', 'Все'], ...B.periods(key).map(p => [p.type, p.title])].map(([v, t]) =>
              `<button class="chip ${filter.period === v ? 'active' : ''}" data-fperiod="${v}">${t}</button>`).join('')}
          </div>
          <label class="field filter-select">
            <select data-fcat aria-label="Категория">
              <option value="all">Все категории</option>
              ${usedCats.map(c => `<option value="${c.id}" ${filter.categoryId === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="card total-card">
          <span class="muted">Итого${filter.period !== 'all' || filter.categoryId !== 'all' ? ' по фильтру' : ''}</span>
          <b>${money(total)}</b>
        </div>

        ${list.length ? (filter.view === 'cats' ? catRows : rows) : `
          <div class="card empty">
            <div class="empty-icon">🧾</div>
            <h2>${all.length ? 'Ничего не найдено' : 'Пока нет трат'}</h2>
            <p>${all.length ? 'Измените фильтры, чтобы увидеть траты.' : 'Нажмите «＋» внизу экрана, чтобы добавить трату.'}</p>
          </div>`}
      `;

      el.querySelectorAll('input[name=view]').forEach(r => r.addEventListener('change', () => {
        filter.view = r.value;
        App.router.render();
      }));
      el.querySelectorAll('[data-fperiod]').forEach(b => b.addEventListener('click', () => {
        filter.period = b.dataset.fperiod;
        App.router.render();
      }));
      el.querySelector('[data-fcat]').addEventListener('change', e => {
        filter.categoryId = e.target.value;
        App.router.render();
      });
      el.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', () => {
        const exp = App.store.get().expenses.find(x => x.id === b.dataset.exp);
        if (exp) App.expenseForm.open(exp);
      }));
    }
  });
})();

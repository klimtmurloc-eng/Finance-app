// Экран категорий и лимитов. Адрес: #/categories или #/categories/2026-12
App.router.register('categories', {
  title: 'Категории',
  render(el, params) {
    const { money, esc } = App.utils;
    const B = App.budget;
    const key = App.ui.monthFromParams(params);
    const cats = B.activeCategories();
    const summary = B.summary(key);

    // Сколько денег периода уже распределено по лимитам
    const allocation = summary.periods.map(p => {
      const limits = cats.reduce((s, c) => s + B.limitFor(key, c.id, p.type), 0);
      const free = p.available - limits;
      return `
        <div class="alloc-row">
          <div>
            <b>${p.title}</b> <span class="small muted">${B.shortDate(p.start)} – ${B.shortDate(p.end)}</span>
            <div class="small muted">Лимиты: ${money(limits)}${p.income > 0 ? ' из ' + money(p.available) : ''}</div>
          </div>
          ${p.income > 0
            ? `<div class="alloc-free ${free < 0 ? 'neg' : ''}"><span class="small muted">${free < 0 ? 'Сверх дохода' : 'Свободно'}</span><b>${money(Math.abs(free))}</b></div>`
            : `<div class="alloc-free"><span class="small muted">Доход</span><b class="muted">не внесён</b></div>`}
        </div>`;
    }).join('');

    function limitLine(cat, p) {
      const limit = B.limitFor(key, cat.id, p.type);
      const spent = B.categorySpent(key, cat.id, p.type);
      const pct = limit > 0 ? Math.min(100, Math.round(spent / limit * 100)) : 0;
      const status = B.limitStatus(spent, limit);
      const note = status === 'over'
        ? `<div class="small st-over">Превышен на ${money(spent - limit)}</div>`
        : status === 'warn' ? `<div class="small st-warn">Осталось ${money(limit - spent)}</div>` : '';
      return `
        <div class="limit-line">
          <div class="limit-line-head small">
            <span>${p.title}</span>
            <span>${limit > 0
              ? `<b class="st-${status}-text">${money(spent)}</b> <span class="muted">из ${money(limit)}</span>`
              : `<span class="muted">без лимита · ${money(spent)}</span>`}</span>
          </div>
          <div class="progress thin"><div class="bar-${status}" style="width:${pct}%"></div></div>
          ${note}
        </div>`;
    }

    const list = cats.map(c => `
      <button class="card cat-card" data-cat="${c.id}">
        <div class="cat-head">
          <span class="cat-icon" style="background:${c.color}1f">${c.icon}</span>
          <span class="cat-name">${esc(c.name)}</span>
          <span class="muted" aria-hidden="true">›</span>
        </div>
        ${summary.periods.map(p => limitLine(c, p)).join('')}
      </button>`).join('');

    el.innerHTML = `
      ${App.ui.monthSwitch('categories', key)}

      ${cats.length ? `<div class="card">${allocation}</div>` : ''}

      <button class="btn btn-block" id="add-cat">＋ Новая категория</button>

      ${cats.length ? list : `
        <div class="card empty">
          <div class="empty-icon">🗂️</div>
          <h2>Категорий пока нет</h2>
          <p>Создайте категории трат, например «Продукты» или «Транспорт», и задайте лимиты на периоды зарплаты и аванса.</p>
        </div>`}
    `;

    el.querySelector('#add-cat').addEventListener('click', () => App.categoryForm.open(key));
    el.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = App.store.get().categories.find(c => c.id === btn.dataset.cat);
        if (cat) App.categoryForm.open(key, cat);
      });
    });
  }
});

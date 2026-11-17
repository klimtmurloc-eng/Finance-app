// Главный экран: бюджет месяца, два периода и список доходов.
// Адрес: #/home или #/home/2026-12 (просмотр другого месяца)
App.router.register('home', {
  title: 'Главная',
  render(el, params) {
    const { money, esc, monthTitle, isoDate } = App.utils;
    const B = App.budget;
    const key = App.ui.monthFromParams(params);
    const s = B.summary(key);
    const today = isoDate();

    function periodCard(p) {
      const isNow = today >= p.start && today <= p.end;
      const pct = p.available > 0 ? Math.min(100, Math.round(p.spent / p.available * 100)) : 0;
      const barStatus = p.available > 0 ? B.limitStatus(p.spent, p.available) : (p.spent > 0 || p.available < 0 ? 'over' : 'ok');
      const carryText = p.carry ? ` · перенос <b class="${p.carry < 0 ? 'neg' : ''}">${p.carry > 0 ? '+' : '−'}${money(Math.abs(p.carry))}</b>` : '';
      const leftClass = p.left < 0 ? 'neg' : '';
      return `
        <div class="card period ${isNow ? 'period-now' : ''}">
          <div class="period-head">
            <div>
              <h3 class="card-title">${p.title} ${isNow ? '<span class="badge">Сейчас</span>' : ''}</h3>
              <div class="small muted">${B.shortDate(p.start)} – ${B.shortDate(p.end)}</div>
            </div>
            <div class="period-left ${leftClass}">
              <div class="small muted">Остаток</div>
              <strong>${money(p.left)}</strong>
            </div>
          </div>
          <div class="progress"><div class="bar-${barStatus}" style="width:${p.available > 0 ? pct : (barStatus === 'over' ? 100 : 0)}%"></div></div>
          <div class="period-foot small">
            ${p.income > 0
              ? `<span>Поступило: <b>${money(p.income)}</b>${carryText}</span>`
              : `<span class="muted">Ещё не поступил${p.type === 'salary' ? 'а' : ''} · ожидается ~${B.shortDate(B.nominalDate(key, p.type))}${carryText}</span>`}
            <span class="muted">Потрачено: ${money(p.spent)}</span>
          </div>
        </div>`;
    }

    const incomes = B.incomesOf(key);
    const incomeRows = incomes.map(i => {
      const period = B.incomePeriod(key, i);
      return `
        <li>
          <button class="list-row list-btn" data-income="${i.id}">
            <span class="row-main">
              <span class="row-title">${B.TYPES[i.type]}${i.comment ? ' · ' + esc(i.comment) : ''}</span>
              <span class="small muted">${B.shortDate(i.date)}${i.type === 'other' ? ' · в период «' + B.TYPES[period] + '»' : ''}</span>
            </span>
            <span class="amount-pos">+${money(i.amount)}</span>
          </button>
        </li>`;
    }).join('');

    const alerts = B.alerts(key);
    const alertsHtml = alerts.length ? `
      <div class="card attention">
        <h3 class="card-title">⚠️ Внимание</h3>
        <ul class="list">
          ${alerts.map(a => `
            <li><a class="list-row list-btn" href="#/categories/${key}">
              <span class="cat-icon sm" style="background:${a.category.color}1f">${a.category.icon}</span>
              <span class="row-main">
                <span class="row-title">${esc(a.category.name)}</span>
                <span class="small muted">${a.period.title} · ${Math.round(a.share * 100)}% лимита</span>
              </span>
              <span class="small st-${a.status}" style="text-align:right">${a.status === 'over'
                ? 'Превышен<br><b>на ' + money(a.spent - a.limit) + '</b>'
                : 'Осталось<br><b>' + money(a.limit - a.spent) + '</b>'}</span>
            </a></li>`).join('')}
        </ul>
      </div>` : '';

    const cats = {};
    App.store.get().categories.forEach(c => { cats[c.id] = c; });

    // ----- Траты по категориям -----
    const breakdown = B.categoryBreakdown(key);
    const catBlock = breakdown.length ? `
      <div class="section-head">
        <p class="section-label">Траты по категориям</p>
        <a class="small link" href="#/categories/${key}">Лимиты →</a>
      </div>
      <div class="card list-card"><ul class="list">
        ${breakdown.map(b => {
          const pct = b.limit > 0 ? Math.min(100, Math.round(b.spent / b.limit * 100)) : 0;
          const parts = s.periods.map(p => {
            const x = b.byPeriod[p.type];
            return `${p.title}: ${money(x.spent)}${x.limit ? ' / ' + money(x.limit) : ''}`;
          }).join(' · ');
          return `<li><button class="list-row list-btn cat-row" data-catfilter="${b.category.id}">
            <span class="cat-icon sm" style="background:${b.category.color}1f">${b.category.icon}</span>
            <span class="row-main">
              <span class="cat-row-top">
                <span class="row-title">${esc(b.category.name)}</span>
                <span class="small"><b class="st-${b.status}-text">${money(b.spent)}</b>${b.limit ? ` <span class="muted">из ${money(b.limit)}</span>` : ''}</span>
              </span>
              ${b.limit ? `<span class="progress thin"><span class="bar-${b.status}" style="width:${pct}%"></span></span>` : ''}
              <span class="small muted">${parts}</span>
            </span>
          </button></li>`;
        }).join('')}
      </ul></div>` : '';

    // ----- Регулярные платежи (только для текущего месяца) -----
    const isCurrent = key === B.currentMonthKey();
    const occList = isCurrent ? App.recurring.overdueFromPast(key).concat(App.recurring.occurrences(key)) : [];
    const occByKey = {};
    occList.forEach(o => { occByKey[o.key] = o; });
    const occRow = o => {
      let right;
      if (o.status === 'paid') {
        right = `<span class="small st-ok-text">✓ Оплачено${o.expense ? '<br><b>' + money(o.expense.amount) + '</b>' : ''}</span>`;
      } else if (o.status === 'skipped') {
        right = `<span class="small muted">Пропущен<br><button class="link-btn" data-unskip="${o.key}">Вернуть</button></span>`;
      } else if (o.status === 'scheduled') {
        right = `<span class="small muted">Спишется<br><b>${B.shortDate(o.due)}</b></span>`;
      } else {
        right = `<span class="occ-actions">
          <button class="btn btn-sm" data-pay="${o.key}">Оплачено</button>
          <button class="btn btn-sm btn-secondary" data-skip="${o.key}">Пропустить</button></span>`;
      }
      const sub = o.status === 'due'
        ? (o.overdue ? `<span class="st-over">Просрочен с ${B.shortDate(o.due)}</span>` : `К оплате ${B.shortDate(o.due)}`)
        : `${B.shortDate(o.due)} · ${o.rec.mode === 'auto' ? 'автоматически' : 'с подтверждением'}`;
      return `<li class="list-row occ-row ${o.status}">
        <span class="row-main">
          <span class="row-title">${esc(o.rec.name)}</span>
          <span class="small muted">${money(o.rec.amount)} · ${sub}</span>
        </span>
        ${right}
      </li>`;
    };
    const dueCount = occList.filter(o => o.status === 'due').length;
    const recBlock = occList.length ? `
      <div class="section-head">
        <p class="section-label">Регулярные платежи${dueCount ? ` · <span class="st-warn">к оплате: ${dueCount}</span>` : ''}</p>
        <a class="small link" href="#/recurring">Управлять →</a>
      </div>
      <div class="card list-card"><ul class="list">${occList.map(occRow).join('')}</ul></div>`
      : (isCurrent ? `<a class="small link" style="align-self:center" href="#/recurring">🔁 Регулярные платежи →</a>` : '');
    const recent = B.expensesOf(key).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const recentRows = recent.length ? `<ul class="list">${recent.map(e => {
      const c = cats[e.categoryId] || { name: 'Без категории', icon: '❔', color: '#475569' };
      return `<li><button class="list-row list-btn" data-exp="${e.id}">
        <span class="cat-icon sm" style="background:${c.color}1f">${c.icon}</span>
        <span class="row-main">
          <span class="row-title">${esc(c.name)}</span>
          <span class="small muted">${B.shortDate(e.date)}${e.comment ? ' · ' + esc(e.comment) : ''}</span>
        </span>
        <span class="amount-neg">−${money(e.amount)}</span>
      </button></li>`;
    }).join('')}</ul>` : '';

    el.innerHTML = `
      ${App.ui.monthSwitch('home', key)}
      ${App.backup.needsReminder() ? `
        <a class="banner" href="#/settings">
          <span>💾</span>
          <span><b>Сохраните резервную копию</b><br><span class="small">${App.backup.daysSinceLast() == null ? 'Вы ещё ни разу её не делали' : 'Последняя была ' + App.backup.daysSinceLast() + ' дн. назад'}. Это займёт пару секунд.</span></span>
        </a>` : ''}

      <div class="card summary">
        <div class="small muted">Остаток на месяц</div>
        <div class="summary-total ${s.left < 0 ? 'neg' : ''}">${money(s.left)}</div>
        ${s.carry ? `
        <div class="carry-row small ${s.carry < 0 ? 'neg' : ''}">
          ${s.carry > 0 ? 'Перенос с прошлого месяца' : 'Долг с прошлого месяца'}: <b>${s.carry > 0 ? '+' : '−'}${money(Math.abs(s.carry))}</b>
          ${B.shiftMonth(key, -1) >= B.currentMonthKey() ? '<span class="muted">(предварительно)</span>' : ''}
        </div>` : ''}
        <div class="summary-row">
          <div><span class="small muted">Доходы</span><b>${money(s.income)}</b></div>
          <div><span class="small muted">Потрачено</span><b>${money(s.spent)}</b></div>
        </div>
      </div>

      ${alertsHtml}

      <button class="btn btn-block" id="add-income">＋ Добавить доход</button>

      ${s.periods.map(periodCard).join('')}

      ${recBlock}

      ${catBlock}

      <div class="section-head">
        <p class="section-label">Последние траты</p>
        <a class="small link" href="#/expenses/${key}">Все траты →</a>
      </div>
      <div class="card">
        ${recentRows || '<p class="muted small" style="margin:0">Трат пока нет. Нажмите «＋» внизу экрана, чтобы добавить.</p>'}
      </div>

      <div class="section-head">
        <p class="section-label">Доходы месяца</p>
        <a class="small link" href="#/history">История месяцев →</a>
      </div>
      <div class="card">
        ${incomes.length
          ? `<ul class="list">${incomeRows}</ul>`
          : `<p class="muted small" style="margin:0">Доходов за этот месяц пока нет. Нажмите «Добавить доход», когда придут деньги.</p>`}
      </div>
    `;

    el.querySelector('#add-income').addEventListener('click', () => App.incomeForm.open());
    el.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => App.recurring.pay(occByKey[b.dataset.pay])));
    el.querySelectorAll('[data-skip]').forEach(b => b.addEventListener('click', () => {
      const o = occByKey[b.dataset.skip];
      if (confirm(`Пропустить «${o.rec.name}» в этом месяце?`)) App.recurring.skip(o);
    }));
    el.querySelectorAll('[data-unskip]').forEach(b => b.addEventListener('click', () => App.recurring.unskip(occByKey[b.dataset.unskip])));
    el.querySelectorAll('[data-catfilter]').forEach(b => b.addEventListener('click', () => {
      App.expensesFilter.categoryId = b.dataset.catfilter;
      App.expensesFilter.period = 'all';
      App.router.go('expenses/' + key);
    }));
    el.querySelectorAll('[data-exp]').forEach(btn => {
      btn.addEventListener('click', () => {
        const exp = App.store.get().expenses.find(x => x.id === btn.dataset.exp);
        if (exp) App.expenseForm.open(exp);
      });
    });
    el.querySelectorAll('[data-income]').forEach(btn => {
      btn.addEventListener('click', () => {
        const inc = App.store.get().incomes.find(i => i.id === btn.dataset.income);
        if (inc) App.incomeForm.open(inc);
      });
    });
  }
});

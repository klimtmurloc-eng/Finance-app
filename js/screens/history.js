// История месяцев: итоги каждого месяца и цепочка переносов. Адрес: #/history
App.router.register('history', {
  title: 'История месяцев',
  render(el) {
    const { money, monthTitle } = App.utils;
    const B = App.budget;
    const list = B.history();
    const current = B.currentMonthKey();
    const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));

    el.innerHTML = `
      <a class="back-link small" href="#/home">‹ На главную</a>
      ${list.length ? list.map(s => {
        const r = B.monthRange(s.key);
        const isNow = s.key === current;
        return `
          <a class="card history-card ${isNow ? 'period-now' : ''}" href="#/home/${s.key}">
            <div class="history-head">
              <div>
                <h3 class="card-title">${monthTitle(s.key)} ${isNow ? '<span class="badge">Сейчас</span>' : ''}</h3>
                <div class="small muted">${B.shortDate(r.start)} – ${B.shortDate(r.end)}</div>
              </div>
              <div class="history-total ${s.left < 0 ? 'neg' : ''}">
                <span class="small muted">${isNow ? 'Остаток сейчас' : 'Итог месяца'}</span>
                <strong>${signed(s.left)}</strong>
              </div>
            </div>
            <div class="history-grid small">
              <div><span class="muted">Перенос</span><b class="${s.carry < 0 ? 'neg' : ''}">${signed(s.carry)}</b></div>
              <div><span class="muted">Доходы</span><b>${money(s.income)}</b></div>
              <div><span class="muted">Траты</span><b>${money(s.spent)}</b></div>
            </div>
          </a>`;
      }).join('') : `
        <div class="card empty">
          <div class="empty-icon">📅</div>
          <h2>История пока пуста</h2>
          <p>Здесь появятся итоги месяцев, когда вы внесёте первые доходы и траты.</p>
        </div>`}
      ${list.length ? '<p class="small muted" style="text-align:center">Итог месяца автоматически переносится в период «Зарплата» следующего месяца — и плюс, и минус.</p>' : ''}
    `;
  }
});

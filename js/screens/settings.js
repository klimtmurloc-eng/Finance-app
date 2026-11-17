// Экран настроек
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

App.router.register('settings', {
  title: 'Настройки',
  render(el) {
    const store = App.store;
    const d = store.get();
    const ok = store.isAvailable();

    const days = App.backup.daysSinceLast();
    const lastText = days == null ? 'ещё не делали'
      : days === 0 ? 'сегодня'
      : days === 1 ? 'вчера'
      : days + ' ' + plural(days, 'день', 'дня', 'дней') + ' назад';
    const stale = App.backup.needsReminder();

    const inst = App.pwa.installState();
    const installHtml = inst === 'installed' ? '' : `
      <p class="section-label">Приложение</p>
      <div class="card backup-card">
        ${inst === 'prompt' ? `
          <p class="small muted" style="margin:0">Добавьте приложение на главный экран — оно будет открываться как обычное и работать без интернета.</p>
          <button class="btn btn-block" id="install-btn">Установить на главный экран</button>` : ''}
        ${inst === 'ios' ? `
          <p class="small" style="margin:0"><b>Как установить на iPhone:</b> откройте эту страницу в Safari, нажмите «Поделиться» <span aria-hidden="true">⎋</span> внизу экрана и выберите «На экран „Домой“».</p>` : ''}
        ${inst === 'manual' ? `
          <p class="small" style="margin:0"><b>Как установить:</b> откройте меню браузера (⋮) и выберите «Установить приложение» или «Добавить на главный экран».</p>` : ''}
      </div>`;

    el.innerHTML = `
      ${installHtml}
      <p class="section-label">Резервная копия</p>
      <div class="card backup-card">
        <div class="list-row" style="padding-top:0">
          <span>Последняя копия</span>
          <span style="font-weight:600; color: var(${stale ? '--warn' : '--text-muted'})">${lastText}</span>
        </div>
        <p class="small muted" style="margin:0">Данные хранятся только на этом телефоне. Сохраняйте копию хотя бы раз в пару недель: она пригодится при смене телефона или очистке браузера.</p>
        <button class="btn btn-block" id="backup-save">Сохранить копию в файл</button>
        ${App.backup.canShare() ? '<button class="btn btn-secondary btn-block" id="backup-share">Отправить копию…</button>' : ''}
        <label class="btn btn-secondary btn-block" for="backup-file">Восстановить из файла</label>
        <input type="file" id="backup-file" accept=".json,application/json" hidden>
      </div>

      <p class="section-label">Платежи</p>
      <a class="card list-row nav-row" href="#/recurring">
        <span>🔁 Регулярные платежи</span>
        <span class="muted">${d.recurring.filter(r => r.active).length || 'нет'} ›</span>
      </a>

      <p class="section-label">Дни выплат</p>
      <div class="card">
        <form id="days-form" class="form">
          <div class="field-row">
            <label class="field">
              <span>Зарплата</span>
              <input name="salaryDay" type="number" inputmode="numeric" min="1" max="31" value="${d.settings.salaryDay}">
            </label>
            <label class="field">
              <span>Аванс</span>
              <input name="advanceDay" type="number" inputmode="numeric" min="1" max="31" value="${d.settings.advanceDay}">
            </label>
          </div>
          <p class="hint" style="margin:0">Плановые числа месяца. Нужны, чтобы делить месяц на периоды, пока деньги ещё не внесены. Когда вы вносите доход с фактической датой, период начинается с неё.</p>
          <button class="btn btn-secondary btn-block" type="submit">Сохранить дни</button>
        </form>
      </div>

      <p class="section-label">Данные</p>
      <div class="card">
        <ul class="list">
          <li class="list-row">
            <span>Хранилище на устройстве</span>
            <span style="color: var(${ok ? '--ok' : '--danger'}); font-weight: 600">${ok ? 'Работает' : 'Недоступно'}</span>
          </li>
          <li class="list-row">
            <span>Объём данных</span>
            <span class="muted">${store.sizeKb()} КБ</span>
          </li>
          <li class="list-row">
            <span>Валюта</span>
            <span class="muted">${App.utils.esc(d.settings.currency)}</span>
          </li>
        </ul>
      </div>

      <p class="section-label">Опасная зона</p>
      <div class="card">
        <p class="small muted" style="margin-top:0">Удалит все категории, траты и настройки с этого устройства. Отменить нельзя.</p>
        <button class="btn btn-danger btn-block" id="reset-btn">Удалить все данные</button>
      </div>

      <p class="small muted" style="text-align:center">Версия приложения ${App.pwa.VERSION} · формат данных ${d.version}</p>
    `;

    const installBtn = el.querySelector('#install-btn');
    if (installBtn) installBtn.addEventListener('click', () => App.pwa.install());

    el.querySelector('#backup-save').addEventListener('click', () => App.backup.download());
    const shareBtn = el.querySelector('#backup-share');
    if (shareBtn) shareBtn.addEventListener('click', () => App.backup.share());
    el.querySelector('#backup-file').addEventListener('change', e => {
      App.backup.restore(e.target.files[0]);
      e.target.value = '';
    });

    el.querySelector('#days-form').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const sal = parseInt(f.salaryDay.value, 10);
      const adv = parseInt(f.advanceDay.value, 10);
      const valid = n => n >= 1 && n <= 31;
      if (!valid(sal) || !valid(adv) || sal === adv) {
        App.utils.toast('Введите разные числа от 1 до 31');
        return;
      }
      store.update(data => {
        data.settings.salaryDay = sal;
        data.settings.advanceDay = adv;
      });
      App.utils.toast('Дни выплат сохранены');
    });

    el.querySelector('#reset-btn').addEventListener('click', () => {
      if (confirm('Удалить все данные приложения? Это действие нельзя отменить.')) {
        store.reset();
        App.utils.toast('Данные удалены');
      }
    });
  }
});

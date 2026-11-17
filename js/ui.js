// Общие элементы интерфейса: нижняя шторка (bottom sheet) и разбор сумм
App.ui = (function () {
  // Открывает шторку снизу. onMount(body, close) — навесить обработчики.
  function sheet({ title, html, onMount }) {
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${App.utils.esc(title)}">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <h2>${App.utils.esc(title)}</h2>
          <button class="icon-btn" data-close aria-label="Закрыть">✕</button>
        </div>
        <div class="sheet-body">${html}</div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => overlay.classList.add('open'));

    function close() {
      overlay.classList.remove('open');
      document.body.classList.remove('no-scroll');
      setTimeout(() => overlay.remove(), 200);
    }
    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.closest('[data-close]')) close();
    });
    if (onMount) onMount(overlay.querySelector('.sheet-body'), close);
    return close;
  }

  // "12 500,50" -> 12500.5 ; пусто/ошибка -> NaN
  function parseAmount(str) {
    const clean = String(str).replace(/\s/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
    return Math.round(parseFloat(clean) * 100) / 100;
  }

  // Переключатель месяцев для экрана route (например, 'home' или 'categories')
  function monthSwitch(route, key) {
    const B = App.budget;
    const { monthTitle } = App.utils;
    const r = B.monthRange(key);
    const current = B.currentMonthKey();
    return `
      <div class="month-switch">
        <a class="icon-btn" href="#/${route}/${B.shiftMonth(key, -1)}" aria-label="Предыдущий месяц">‹</a>
        <div class="month-switch-title">
          <strong>${monthTitle(key)}</strong>
          <span class="small muted">${B.shortDate(r.start)} – ${B.shortDate(r.end)}</span>
        </div>
        <a class="icon-btn" href="#/${route}/${B.shiftMonth(key, 1)}" aria-label="Следующий месяц">›</a>
      </div>
      ${key !== current ? `<a class="back-now small" href="#/${route}">Вернуться к текущему месяцу</a>` : ''}`;
  }

  // Месяц из параметров адреса или текущий
  function monthFromParams(params) {
    return /^\d{4}-\d{2}$/.test(params[0] || '') ? params[0] : App.budget.currentMonthKey();
  }

  return { sheet, parseAmount, monthSwitch, monthFromParams };
})();

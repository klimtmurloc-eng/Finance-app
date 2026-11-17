// Общие вспомогательные функции. Всё приложение живёт в глобальном объекте App.
window.App = window.App || {};

App.utils = (function () {
  const wholeFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const centsFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 12345 -> "12 345 ₽", 12345.5 -> "12 345,50 ₽"
  function money(value, currency) {
    const cur = currency || (App.store ? App.store.get().settings.currency : '₽');
    const n = Math.round((Number(value) || 0) * 100) / 100;
    const fmt = Number.isInteger(n) ? wholeFormat : centsFormat;
    return fmt.format(n) + ' ' + cur;
  }

  // Уникальный идентификатор для категорий, трат и т.п.
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Безопасная вставка текста в HTML
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Дата -> "2026-11-16" (по местному времени)
  function isoDate(d) {
    const date = d || new Date();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + m + '-' + day;
  }

  const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

  // "2026-11" -> "Ноябрь 2026"
  function monthTitle(key) {
    const [y, m] = key.split('-').map(Number);
    const name = MONTHS[m - 1];
    return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y;
  }

  let toastTimer;
  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  return { money, uid, esc, isoDate, monthTitle, toast };
})();

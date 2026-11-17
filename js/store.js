// Хранилище данных. Все данные лежат на устройстве (localStorage) одним JSON-объектом.
// Экраны работают только через App.store, поэтому способ хранения можно поменять в одном месте.
App.store = (function () {
  const KEY = 'finance-app-data';
  const VERSION = 1;

  // Структура данных приложения (заполняется на следующих этапах)
  function defaults() {
    return {
      version: VERSION,
      settings: {
        currency: '₽',
        advanceDay: 18,     // плановый день аванса (ориентир, если деньги ещё не внесены)
        salaryDay: 3,       // плановый день зарплаты
        lastCategoryId: null,
        lastBackupAt: null  // когда последний раз сохраняли резервную копию
      },
      months: {},           // "2026-11": { carryOver, closed } (этап 7)
      categories: [],       // { id, name, color, icon, archived } (этап 3)
      limits: {},           // "2026-11": { [categoryId]: { advance, salary } } (этап 3)
      expenses: [],         // { id, amount, categoryId, date, comment, monthKey, period } (этап 4)
      incomes: [],          // { id, type: 'salary'|'advance'|'other', amount, date, comment, monthKey }
      recurring: [],        // шаблоны регулярных платежей (см. js/recurring.js)
      recurringLog: {},     // "<id>:<месяц>": 'paid' | 'skipped'
      createdAt: new Date().toISOString()
    };
  }

  let data = null;
  const listeners = [];

  // Миграции между версиями формата данных, чтобы старые данные не терялись при обновлениях
  function migrate(raw) {
    const base = defaults();
    const merged = Object.assign({}, base, raw);
    merged.settings = Object.assign({}, base.settings, raw.settings || {});
    // Пустые значения из старых версий заменяем значениями по умолчанию
    Object.keys(base.settings).forEach(k => {
      if (merged.settings[k] == null) merged.settings[k] = base.settings[k];
    });
    merged.version = VERSION;
    return merged;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? migrate(JSON.parse(raw)) : defaults();
    } catch (e) {
      console.error('Не удалось прочитать данные', e);
      data = defaults();
    }
    return data;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Не удалось сохранить данные', e);
      App.utils.toast('Ошибка сохранения данных');
      return false;
    }
  }

  function get() {
    return data || load();
  }

  // Изменение данных: update(d => { d.settings.currency = '$'; })
  function update(mutator) {
    mutator(get());
    save();
    listeners.forEach(fn => fn(data));
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  function reset() {
    data = defaults();
    save();
    listeners.forEach(fn => fn(data));
  }

  // Проверка, что объект похож на данные приложения (для восстановления из файла)
  function validate(raw) {
    if (!raw || typeof raw !== 'object') return 'Файл не похож на резервную копию';
    const arrays = ['categories', 'expenses', 'incomes', 'recurring'];
    for (const k of arrays) {
      if (raw[k] != null && !Array.isArray(raw[k])) return 'Повреждён раздел «' + k + '»';
    }
    if (!Array.isArray(raw.categories) || !Array.isArray(raw.expenses) || !raw.settings) {
      return 'Файл не похож на резервную копию приложения';
    }
    if (raw.version > VERSION) return 'Копия сделана в более новой версии приложения';
    const badExpense = raw.expenses.find(e => !(e.amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || ''));
    if (badExpense) return 'В копии есть повреждённые траты';
    return null;
  }

  // Полная замена данных (восстановление из копии)
  function replace(raw) {
    const err = validate(raw);
    if (err) throw new Error(err);
    data = migrate(raw);
    save();
    listeners.forEach(fn => fn(data));
  }

  // Примерный объём занятых данных в килобайтах
  function sizeKb() {
    const raw = localStorage.getItem(KEY) || '';
    return Math.round((raw.length * 2) / 1024 * 10) / 10;
  }

  function isAvailable() {
    try {
      const t = '__test__';
      localStorage.setItem(t, t);
      localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  }

  return { load, save, get, update, subscribe, reset, replace, validate, sizeKb, isAvailable, VERSION };
})();

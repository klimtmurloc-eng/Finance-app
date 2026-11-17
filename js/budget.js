// Логика бюджета: месяцы, периоды «Зарплата» и «Аванс», доходы и остатки.
// Даты хранятся строками "ГГГГ-ММ-ДД", месяцы бюджета — ключами "ГГГГ-ММ".
App.budget = (function () {
  const TYPES = {
    salary: 'Зарплата',
    advance: 'Аванс',
    other: 'Прочее'
  };

  // ---------- Работа с датами ----------
  function parse(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 12); // полдень — без сюрпризов с часовыми поясами
  }
  const iso = d => App.utils.isoDate(d);

  function addDays(s, n) {
    const d = parse(s);
    d.setDate(d.getDate() + n);
    return iso(d);
  }

  function shiftMonth(key, n) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1, 12);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // День месяца с учётом короткого месяца (31-е в феврале -> 28/29)
  function dateInMonth(key, day) {
    const [y, m] = key.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return key + '-' + String(Math.min(day, last)).padStart(2, '0');
  }

  const SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  // "2026-11-03" -> "3 ноя"
  function shortDate(s) {
    const d = parse(s);
    return d.getDate() + ' ' + SHORT[d.getMonth()];
  }

  // ---------- Периоды ----------
  // Порядок периодов внутри месяца бюджета: сначала та выплата, у которой день раньше
  function order() {
    const s = App.store.get().settings;
    return s.salaryDay <= s.advanceDay ? ['salary', 'advance'] : ['advance', 'salary'];
  }

  function nominalDate(key, type) {
    const s = App.store.get().settings;
    return dateInMonth(key, type === 'salary' ? s.salaryDay : s.advanceDay);
  }

  // Фактическая дата выплаты, если она уже внесена (самая ранняя такого типа в этом месяце)
  function actualDate(key, type) {
    const dates = App.store.get().incomes
      .filter(i => i.monthKey === key && i.type === type)
      .map(i => i.date)
      .sort();
    return dates[0] || null;
  }

  function periodStart(key, type) {
    return actualDate(key, type) || nominalDate(key, type);
  }

  // Кэш периодов: сбрасывается при любом изменении данных
  let cache = {};
  App.store.subscribe(() => { cache = {}; });

  // Периоды месяца: [{ type, title, start, end, received }]
  function periods(key) {
    if (!cache[key]) cache[key] = computePeriods(key);
    return cache[key];
  }

  function computePeriods(key) {
    const [first, second] = order();
    let firstStart = periodStart(key, first);
    let secondStart = periodStart(key, second);
    let nextStart = periodStart(shiftMonth(key, 1), first);

    // Защита от наложения периодов при необычных датах
    if (secondStart <= firstStart) secondStart = addDays(firstStart, 1);
    if (nextStart <= secondStart) nextStart = addDays(secondStart, 1);

    return [
      { type: first, title: TYPES[first], start: firstStart, end: addDays(secondStart, -1), received: !!actualDate(key, first) },
      { type: second, title: TYPES[second], start: secondStart, end: addDays(nextStart, -1), received: !!actualDate(key, second) }
    ];
  }

  function monthRange(key) {
    const p = periods(key);
    return { start: p[0].start, end: p[1].end };
  }

  // Месяц бюджета, в который попадает дата
  function monthForDate(s) {
    const cal = s.slice(0, 7);
    for (const key of [cal, shiftMonth(cal, -1), shiftMonth(cal, 1)]) {
      const r = monthRange(key);
      if (s >= r.start && s <= r.end) return key;
    }
    return cal;
  }

  // Период внутри месяца, в который попадает дата (если дата вне месяца — ближайший)
  function periodForDate(key, s) {
    const p = periods(key);
    if (s >= p[1].start) return p[1].type;
    return p[0].type;
  }

  function currentMonthKey() {
    return monthForDate(iso(new Date()));
  }

  // Подсказка: в какой месяц отнести выплату (ближайшая плановая дата такого типа)
  function suggestMonth(type, date) {
    if (type === 'other') return monthForDate(date);
    const cal = date.slice(0, 7);
    const t = parse(date).getTime();
    let best = cal, bestDiff = Infinity;
    for (const key of [shiftMonth(cal, -1), cal, shiftMonth(cal, 1)]) {
      const diff = Math.abs(parse(nominalDate(key, type)).getTime() - t);
      if (diff < bestDiff) { bestDiff = diff; best = key; }
    }
    return best;
  }

  // ---------- Суммы ----------
  function incomesOf(key) {
    return App.store.get().incomes
      .filter(i => i.monthKey === key)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function incomePeriod(key, income) {
    return income.type === 'other' ? periodForDate(key, income.date) : income.type;
  }

  // Где находится трата. Если период выбран вручную — берём сохранённые месяц и период,
  // иначе определяем по дате (так трата сама переедет, если, например, зарплата пришла раньше).
  function expenseMonth(e) {
    return e.periodManual ? e.monthKey : monthForDate(e.date);
  }
  function expensePeriod(e) {
    return e.periodManual ? e.period : periodForDate(expenseMonth(e), e.date);
  }

  function expensesOf(key) {
    return App.store.get().expenses.filter(e => expenseMonth(e) === key);
  }

  const round2 = n => Math.round(n * 100) / 100;

  // Первый месяц, в котором есть доходы или траты (с него начинается цепочка переносов)
  function firstDataMonth() {
    if (cache.__first === undefined) {
      const d = App.store.get();
      const keys = d.incomes.map(i => i.monthKey).concat(d.expenses.map(expenseMonth)).sort();
      cache.__first = keys[0] || null;
    }
    return cache.__first;
  }

  function monthIncome(key) {
    return round2(incomesOf(key).reduce((s, i) => s + i.amount, 0));
  }
  function monthSpent(key) {
    return round2(expensesOf(key).reduce((s, e) => s + e.amount, 0));
  }

  // Перенос из прошлого месяца: его итоговый остаток (может быть отрицательным).
  // Остаток каждого месяца = перенос в него + доходы − траты, поэтому переносы идут цепочкой.
  function carryIn(key) {
    const ck = 'carry:' + key;
    if (cache[ck] !== undefined) return cache[ck];
    const first = firstDataMonth();
    let carry = 0;
    if (first && key > first) {
      for (let k = first; k < key; k = shiftMonth(k, 1)) {
        carry = round2(carry + monthIncome(k) - monthSpent(k));
      }
    }
    cache[ck] = carry;
    return carry;
  }

  // Сводка по месяцу: доходы, перенос, траты и остатки по каждому периоду.
  // Перенос с прошлого месяца добавляется к периоду «Зарплата».
  function summary(key) {
    const carry = carryIn(key);
    const list = periods(key).map(p => Object.assign({}, p, {
      income: 0, spent: 0, carry: p.type === 'salary' ? carry : 0
    }));
    const byType = {};
    list.forEach(p => { byType[p.type] = p; });

    incomesOf(key).forEach(i => { byType[incomePeriod(key, i)].income += i.amount; });
    expensesOf(key).forEach(e => {
      byType[expensePeriod(e)].spent += e.amount;
    });
    list.forEach(p => {
      p.income = round2(p.income);
      p.spent = round2(p.spent);
      p.available = round2(p.income + p.carry); // сколько всего денег в периоде
      p.left = round2(p.available - p.spent);
    });

    const income = round2(list.reduce((s, p) => s + p.income, 0));
    const spent = round2(list.reduce((s, p) => s + p.spent, 0));
    return { key, periods: list, carry, income, spent, left: round2(carry + income - spent) };
  }

  // История: все месяцы от первого с данными до текущего (или до key, если он позже), новые сверху
  function history() {
    const first = firstDataMonth();
    if (!first) return [];
    const last = currentMonthKey() > first ? currentMonthKey() : first;
    const list = [];
    for (let k = first; k <= last; k = shiftMonth(k, 1)) list.push(summary(k));
    return list.reverse();
  }

  // ---------- Категории и лимиты ----------
  // Лимиты хранятся как история изменений: limits["2026-11"][catId] = { salary, advance }.
  // Действующий лимит месяца — последнее заданное значение в этом или более раннем месяце.
  function activeCategories() {
    return App.store.get().categories.filter(c => !c.archived);
  }

  function limitFor(key, catId, period) {
    const limits = App.store.get().limits;
    const keys = Object.keys(limits).filter(k => k <= key).sort().reverse();
    for (const k of keys) {
      const entry = limits[k][catId];
      if (entry && entry[period] != null) return entry[period];
    }
    return 0;
  }

  // Меняет лимит начиная с месяца key; более поздние изменения этого лимита сбрасываются,
  // чтобы новое значение действовало во всех следующих месяцах. Вызывать внутри store.update.
  function setLimit(data, key, catId, period, value) {
    Object.keys(data.limits).forEach(k => {
      if (k > key && data.limits[k][catId]) {
        delete data.limits[k][catId][period];
        if (!Object.keys(data.limits[k][catId]).length) delete data.limits[k][catId];
        if (!Object.keys(data.limits[k]).length) delete data.limits[k];
      }
    });
    data.limits[key] = data.limits[key] || {};
    data.limits[key][catId] = data.limits[key][catId] || {};
    data.limits[key][catId][period] = value;
  }

  // Потрачено по категории в периоде месяца
  function categorySpent(key, catId, period) {
    return expensesOf(key)
      .filter(e => e.categoryId === catId && expensePeriod(e) === period)
      .reduce((s, e) => s + e.amount, 0);
  }

  // ---------- Состояние лимита ----------
  const WARN_SHARE = 0.8; // с 80% — жёлтый

  // 'none' — лимита нет, 'ok' — до 80%, 'warn' — 80–100%, 'over' — превышен
  function limitStatus(spent, limit) {
    if (!(limit > 0)) return 'none';
    if (spent > limit) return 'over';
    if (spent >= limit * WARN_SHARE) return 'warn';
    return 'ok';
  }

  // Все пары «категория + период» месяца с лимитом, где уже почти исчерпано или превышено
  function alerts(key) {
    const list = [];
    activeCategories().forEach(c => {
      periods(key).forEach(p => {
        const limit = limitFor(key, c.id, p.type);
        const spent = categorySpent(key, c.id, p.type);
        const status = limitStatus(spent, limit);
        if (status === 'warn' || status === 'over') {
          list.push({ category: c, period: p, limit, spent, status, share: spent / limit });
        }
      });
    });
    return list.sort((a, b) => b.share - a.share);
  }

  // Траты месяца по категориям: сколько потрачено и какой лимит (в сумме и по каждому периоду).
  // Включает скрытые категории, если в них есть траты. Сортировка — по сумме трат.
  function categoryBreakdown(key) {
    const data = App.store.get();
    const exps = expensesOf(key);
    return data.categories
      .filter(c => !c.archived || exps.some(e => e.categoryId === c.id))
      .map(c => {
        const byPeriod = {};
        periods(key).forEach(p => {
          byPeriod[p.type] = { spent: categorySpent(key, c.id, p.type), limit: c.archived ? 0 : limitFor(key, c.id, p.type) };
        });
        const spent = round2(Object.values(byPeriod).reduce((s, x) => s + x.spent, 0));
        const limit = round2(Object.values(byPeriod).reduce((s, x) => s + x.limit, 0));
        const count = exps.filter(e => e.categoryId === c.id).length;
        return { category: c, spent, limit, count, byPeriod, status: limitStatus(spent, limit) };
      })
      .sort((a, b) => b.spent - a.spent || a.category.name.localeCompare(b.category.name));
  }

  return {
    categoryBreakdown,
    WARN_SHARE, limitStatus, alerts, carryIn, history, firstDataMonth,
    expenseMonth, expensePeriod, expensesOf,
    activeCategories, limitFor, setLimit, categorySpent,
    TYPES, parse, addDays, shiftMonth, shortDate,
    periods, monthRange, monthForDate, periodForDate, currentMonthKey,
    suggestMonth, nominalDate, incomesOf, incomePeriod, summary
  };
})();

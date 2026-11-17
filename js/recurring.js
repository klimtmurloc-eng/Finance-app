// Регулярные платежи.
// Шаблон: { id, name, amount, categoryId, day, mode: 'auto'|'confirm', period: 'auto'|'salary'|'advance',
//           startMonth, active, comment }
// Журнал: data.recurringLog["<id>:<месяц>"] = 'paid' | 'skipped'
App.recurring = (function () {
  const B = App.budget;
  const MODES = { auto: 'Автоматически', confirm: 'С подтверждением' };

  const occKey = (rec, month) => rec.id + ':' + month;

  // Дата платежа в месяце бюджета: число day внутри границ месяца
  // (например, 1-е число для «Ноября» 3 ноя – 2 дек — это 1 декабря)
  function dueDate(rec, month) {
    const dateIn = k => {
      const [y, m] = k.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      return k + '-' + String(Math.min(rec.day, last)).padStart(2, '0');
    };
    const r = B.monthRange(month);
    let d = dateIn(month);
    if (d < r.start) d = dateIn(B.shiftMonth(month, 1));
    return d;
  }

  function periodOf(rec, month, date) {
    return rec.period === 'auto' ? B.periodForDate(month, date) : rec.period;
  }

  function activeList() {
    return App.store.get().recurring.filter(r => r.active);
  }

  // Все платежи месяца бюджета со статусом:
  // 'paid' | 'skipped' | 'scheduled' (авто, ещё не наступил) | 'due' (ждёт подтверждения)
  function occurrences(month) {
    const d = App.store.get();
    const today = App.utils.isoDate();
    return activeList()
      .filter(r => r.startMonth <= month)
      .map(rec => {
        const key = occKey(rec, month);
        const due = dueDate(rec, month);
        const logged = d.recurringLog[key];
        const status = logged || (rec.mode === 'auto' ? 'scheduled' : 'due');
        const expense = d.expenses.find(e => e.recurringKey === key) || null;
        return { rec, key, month, due, status, expense, overdue: status === 'due' && due < today };
      })
      .sort((a, b) => a.due.localeCompare(b.due));
  }

  // Неоплаченные платежи «с подтверждением» за прошлые месяцы (просроченные)
  function overdueFromPast(current) {
    const list = [];
    activeList().filter(r => r.mode === 'confirm').forEach(rec => {
      for (let m = rec.startMonth; m < current; m = B.shiftMonth(m, 1)) {
        const o = occurrences(m).find(x => x.rec.id === rec.id);
        if (o && o.status === 'due') list.push(o);
      }
    });
    return list;
  }

  // Трата из платежа (для автосоздания)
  function makeExpense(occ, amount, date) {
    const d = date || occ.due;
    return {
      id: App.utils.uid(),
      amount: amount != null ? amount : occ.rec.amount,
      categoryId: occ.rec.categoryId,
      date: d,
      comment: occ.rec.name,
      periodManual: true,          // закрепляем трату за месяцем и периодом платежа
      monthKey: occ.month,
      period: periodOf(occ.rec, occ.month, d),
      recurringId: occ.rec.id,
      recurringKey: occ.key
    };
  }

  // Создаёт траты для автоматических платежей, у которых наступил день. Возвращает названия.
  function process() {
    const today = App.utils.isoDate();
    const current = B.currentMonthKey();
    const data = App.store.get();
    const toCreate = [];
    activeList().filter(r => r.mode === 'auto').forEach(rec => {
      if (!data.categories.some(c => c.id === rec.categoryId)) return;
      for (let m = rec.startMonth; m <= current; m = B.shiftMonth(m, 1)) {
        const key = occKey(rec, m);
        if (data.recurringLog[key]) continue;
        const occ = { rec, key, month: m, due: dueDate(rec, m) };
        if (occ.due <= today) toCreate.push(makeExpense(occ));
      }
    });
    if (!toCreate.length) return [];
    App.store.update(d => {
      toCreate.forEach(e => {
        d.expenses.push(e);
        d.recurringLog[e.recurringKey] = 'paid';
      });
    });
    return toCreate.map(e => e.comment);
  }

  // Отметить платёж «с подтверждением» оплаченным: открывает форму траты с подставленными данными
  function pay(occ) {
    // Оплата записывается сегодняшним днём; период — по дате или закреплённый в шаблоне
    const today = App.utils.isoDate();
    const month = B.monthForDate(today);
    const preset = Object.assign(makeExpense(occ, occ.rec.amount, today), {
      monthKey: month,
      periodManual: occ.rec.period !== 'auto',
      period: periodOf(occ.rec, month, today)
    });
    App.expenseForm.open(null, {
      title: 'Оплата: ' + occ.rec.name,
      preset,
      onSave: (d, record) => {
        record.recurringId = occ.rec.id;
        record.recurringKey = occ.key;
        d.recurringLog[occ.key] = 'paid';
      }
    });
  }

  function skip(occ) {
    App.store.update(d => { d.recurringLog[occ.key] = 'skipped'; });
    App.utils.toast('Платёж пропущен в этом месяце');
  }

  function unskip(occ) {
    App.store.update(d => { delete d.recurringLog[occ.key]; });
  }

  return { MODES, dueDate, occurrences, overdueFromPast, process, pay, skip, unskip, occKey };
})();

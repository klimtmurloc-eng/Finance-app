// Экран «Регулярные платежи» (#/recurring) и форма шаблона платежа
App.recurringForm = (function () {
  const { esc, monthTitle, toast, money } = App.utils;
  const B = App.budget;

  function open(existing) {
    const editing = !!existing;
    const cats = B.activeCategories();
    if (editing && !cats.some(c => c.id === existing.categoryId)) {
      const old = App.store.get().categories.find(c => c.id === existing.categoryId);
      if (old) cats.push(old);
    }
    if (!cats.length) {
      App.ui.sheet({
        title: 'Новый платёж',
        html: `<div class="empty" style="padding:8px 0 4px">
          <div class="empty-icon">🗂️</div><h2>Сначала создайте категорию</h2>
          <p>Регулярный платёж записывается как трата в выбранную категорию.</p>
          <a class="btn btn-block" href="#/categories" data-close>Перейти к категориям</a></div>`
      });
      return;
    }

    const current = B.currentMonthKey();
    const rec = existing || {
      name: '', amount: '', categoryId: cats[0].id, day: '', mode: 'auto', period: 'auto', active: true
    };
    const seg = (name, options, value) => `
      <div class="segmented" style="grid-template-columns:repeat(${options.length},1fr)">
        ${options.map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''}><span>${t}</span></label>`).join('')}
      </div>`;

    const html = `
      <form class="form" novalidate>
        <label class="field"><span>Название</span>
          <input name="name" maxlength="40" placeholder="Например: Аренда" value="${esc(rec.name)}" autocomplete="off"></label>

        <div class="field-row">
          <label class="field"><span>Сумма</span>
            <input name="amount" inputmode="decimal" placeholder="0" value="${esc(rec.amount)}" autocomplete="off"></label>
          <label class="field" style="max-width:120px"><span>Число месяца</span>
            <input name="day" type="number" inputmode="numeric" min="1" max="31" placeholder="1–31" value="${esc(rec.day)}"></label>
        </div>

        <div class="field"><span>Категория</span>
          <div class="cat-chips">
            ${cats.map(c => `<label class="cat-chip"><input type="radio" name="categoryId" value="${c.id}" ${c.id === rec.categoryId ? 'checked' : ''}>
              <span><i style="background:${c.color}1f">${c.icon}</i>${esc(c.name)}</span></label>`).join('')}
          </div>
        </div>

        <div class="field"><span>Как списывать</span>
          ${seg('mode', [['auto', 'Автоматически'], ['confirm', 'С подтверждением']], rec.mode)}
          <p class="hint" data-mode-hint style="margin:2px 0 0"></p>
        </div>

        <div class="field"><span>Из какого периода</span>
          ${seg('period', [['auto', 'По дате'], ['salary', 'Зарплата'], ['advance', 'Аванс']], rec.period)}
        </div>

        ${editing ? `
          <label class="check-row"><input type="checkbox" name="paused" ${rec.active ? '' : 'checked'}>
            <span>Приостановить платёж</span></label>` : `
          <div class="field"><span>Начать</span>
            ${seg('start', [[current, 'С этого месяца'], [B.shiftMonth(current, 1), 'Со следующего']], current)}
            <p class="hint" data-start-hint style="margin:2px 0 0"></p>
          </div>`}

        <p class="error" data-error hidden></p>
        <button class="btn btn-block" type="submit">${editing ? 'Сохранить' : 'Создать платёж'}</button>
        ${editing ? '<button class="btn btn-danger btn-block" type="button" data-delete>Удалить платёж</button>' : ''}
      </form>`;

    App.ui.sheet({
      title: editing ? 'Регулярный платёж' : 'Новый платёж',
      html,
      onMount(body, close) {
        const form = body.querySelector('form');
        const errEl = form.querySelector('[data-error]');
        const fail = (m, el) => { errEl.textContent = m; errEl.hidden = false; if (el) el.focus(); };
        const val = n => (form.querySelector(`input[name=${n}]:checked`) || {}).value;

        function hints() {
          form.querySelector('[data-mode-hint]').textContent = val('mode') === 'auto'
            ? 'В нужный день трата добавится сама. Подходит для подписок и кредита.'
            : 'В нужный день платёж появится в списке «К оплате» на главной. Сумму можно поправить при оплате.';
          const startHint = form.querySelector('[data-start-hint]');
          const day = parseInt(form.day.value, 10);
          if (startHint && day >= 1 && day <= 31) {
            const due = App.recurring.dueDate({ day }, val('start'));
            const passed = due <= App.utils.isoDate();
            startHint.textContent = `Первый платёж: ${B.shortDate(due)}` +
              (passed && val('mode') === 'auto' ? ' — уже наступил, трата добавится сразу' : '') +
              (passed && val('mode') === 'confirm' ? ' — уже наступил, появится в «К оплате»' : '');
          } else if (startHint) startHint.textContent = '';
        }
        hints();
        form.addEventListener('change', hints);
        form.day.addEventListener('input', hints);

        form.addEventListener('submit', e => {
          e.preventDefault();
          const name = form.name.value.trim();
          if (!name) return fail('Введите название', form.name);
          const amount = App.ui.parseAmount(form.amount.value);
          if (!(amount > 0)) return fail('Введите сумму больше нуля', form.amount);
          const day = parseInt(form.day.value, 10);
          if (!(day >= 1 && day <= 31)) return fail('Число месяца — от 1 до 31', form.day);

          const fields = {
            name, amount, day,
            categoryId: val('categoryId'),
            mode: val('mode'),
            period: val('period')
          };
          close();
          App.store.update(d => {
            if (editing) {
              const r = d.recurring.find(x => x.id === existing.id);
              Object.assign(r, fields, { active: !form.paused.checked });
            } else {
              d.recurring.push(Object.assign({ id: App.utils.uid(), startMonth: val('start'), active: true }, fields));
            }
          });
          const created = App.recurring.process();
          toast(created.length ? `Добавлена трата: ${created.join(', ')}` : (editing ? 'Платёж сохранён' : 'Платёж создан'));
        });

        const del = form.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => {
          if (!confirm('Удалить регулярный платёж? Уже записанные траты останутся.')) return;
          close();
          App.store.update(d => {
            d.recurring = d.recurring.filter(r => r.id !== existing.id);
            Object.keys(d.recurringLog).forEach(k => { if (k.startsWith(existing.id + ':')) delete d.recurringLog[k]; });
          });
          toast('Платёж удалён');
        });

        if (!editing) setTimeout(() => form.name.focus(), 250);
      }
    });
  }

  return { open };
})();

App.router.register('recurring', {
  title: 'Регулярные платежи',
  render(el) {
    const { money, esc } = App.utils;
    const B = App.budget;
    const data = App.store.get();
    const cats = {};
    data.categories.forEach(c => { cats[c.id] = c; });
    const current = B.currentMonthKey();
    const list = data.recurring.slice().sort((a, b) => (b.active - a.active) || a.day - b.day);
    const total = list.filter(r => r.active).reduce((s, r) => s + r.amount, 0);

    el.innerHTML = `
      <a class="back-link small" href="#/home">‹ На главную</a>
      ${list.length ? `<div class="card total-card"><span class="muted">В месяц</span><b>${money(total)}</b></div>` : ''}
      <button class="btn btn-block" id="add-rec">＋ Новый платёж</button>
      ${list.length ? `<div class="card list-card"><ul class="list">${list.map(r => {
        const c = cats[r.categoryId] || { icon: '❔', color: '#475569', name: '—' };
        const due = r.active ? App.recurring.dueDate(r, r.startMonth > current ? r.startMonth : current) : null;
        return `<li><button class="list-row list-btn ${r.active ? '' : 'paused'}" data-rec="${r.id}">
          <span class="cat-icon sm" style="background:${c.color}1f">${c.icon}</span>
          <span class="row-main">
            <span class="row-title">${esc(r.name)}</span>
            <span class="small muted">${r.active ? `${r.day}-го · ${r.mode === 'auto' ? 'автоматически' : 'с подтверждением'}` : 'приостановлен'} · ${esc(c.name)}</span>
          </span>
          <span style="text-align:right"><b>${money(r.amount)}</b>${due ? `<br><span class="small muted">${B.shortDate(due)}</span>` : ''}</span>
        </button></li>`;
      }).join('')}</ul></div>` : `
        <div class="card empty">
          <div class="empty-icon">🔁</div>
          <h2>Регулярных платежей пока нет</h2>
          <p>Добавьте аренду, подписки, кредит или коммуналку — приложение будет напоминать о них или записывать сами.</p>
        </div>`}
    `;
    el.querySelector('#add-rec').addEventListener('click', () => App.recurringForm.open());
    el.querySelectorAll('[data-rec]').forEach(b => b.addEventListener('click', () => {
      const r = App.store.get().recurring.find(x => x.id === b.dataset.rec);
      if (r) App.recurringForm.open(r);
    }));
  }
});

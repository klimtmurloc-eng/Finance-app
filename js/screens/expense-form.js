// Форма добавления / редактирования траты
App.expenseForm = (function () {
  const { esc, isoDate, monthTitle, toast, money } = App.utils;
  const B = App.budget;

  // open() — новая трата; open(трата) — редактирование;
  // open(null, { preset, title, onSave(d, record) }) — новая трата с подставленными данными (регулярный платёж)
  function open(existing, opts) {
    opts = opts || {};
    const editing = !!existing;
    const data = App.store.get();
    const cats = B.activeCategories();

    // Если трата из скрытой категории — показываем и её
    if (editing && !cats.some(c => c.id === existing.categoryId)) {
      const old = data.categories.find(c => c.id === existing.categoryId);
      if (old) cats.push(old);
    }

    if (!cats.length) {
      App.ui.sheet({
        title: 'Новая трата',
        html: `
          <div class="empty" style="padding:8px 0 4px">
            <div class="empty-icon">🗂️</div>
            <h2>Сначала создайте категорию</h2>
            <p>Траты записываются в категории, например «Продукты» или «Транспорт».</p>
            <a class="btn btn-block" href="#/categories" data-close>Перейти к категориям</a>
          </div>`
      });
      return;
    }

    const init = existing || opts.preset || {
      amount: '',
      categoryId: cats.some(c => c.id === data.settings.lastCategoryId) ? data.settings.lastCategoryId : cats[0].id,
      date: isoDate(),
      comment: '',
      periodManual: false
    };

    const html = `
      <form class="form" novalidate>
        <label class="field">
          <span>Сумма</span>
          <input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(init.amount)}" class="input-amount">
        </label>

        <div class="field">
          <span>Категория</span>
          <div class="cat-chips">
            ${cats.map(c => `
              <label class="cat-chip">
                <input type="radio" name="categoryId" value="${c.id}" ${c.id === init.categoryId ? 'checked' : ''}>
                <span><i style="background:${c.color}1f">${c.icon}</i>${esc(c.name)}</span>
              </label>`).join('')}
          </div>
        </div>

        <label class="field">
          <span>Дата</span>
          <input name="date" type="date" value="${esc(init.date)}" required>
        </label>

        <div class="field">
          <span>Период</span>
          <div class="segmented two" role="radiogroup" aria-label="Период" data-periods></div>
          <p class="hint" data-period-hint style="margin:2px 0 0"></p>
        </div>

        <label class="field">
          <span>Комментарий <em class="muted">(необязательно)</em></span>
          <input name="comment" maxlength="80" placeholder="Например: Пятёрочка" value="${esc(init.comment)}">
        </label>

        <p class="limit-hint" data-limit></p>
        <p class="error" data-error hidden></p>

        <button class="btn btn-block" type="submit">${editing ? 'Сохранить' : 'Добавить трату'}</button>
        ${editing ? '<button class="btn btn-danger btn-block" type="button" data-delete>Удалить трату</button>' : ''}
      </form>`;

    App.ui.sheet({
      title: opts.title || (editing ? 'Трата' : 'Новая трата'),
      html,
      onMount(body, close) {
        const form = body.querySelector('form');
        const periodsEl = form.querySelector('[data-periods]');
        let manual = !!init.periodManual;
        let chosenPeriod = editing ? B.expensePeriod(existing) : (init.periodManual ? init.period : null);

        const monthKey = () => (init.monthKey && manual && form.date.value === init.date)
          ? init.monthKey
          : B.monthForDate(form.date.value || isoDate());
        const autoPeriod = () => B.periodForDate(monthKey(), form.date.value || isoDate());
        const selectedPeriod = () => (manual ? chosenPeriod : autoPeriod());

        function renderPeriods() {
          const key = monthKey();
          const sel = selectedPeriod();
          periodsEl.innerHTML = B.periods(key).map(p => `
            <label><input type="radio" name="period" value="${p.type}" ${p.type === sel ? 'checked' : ''}>
              <span>${p.title}<small>${B.shortDate(p.start)} – ${B.shortDate(p.end)}</small></span></label>`).join('');
          form.querySelector('[data-period-hint]').textContent = manual && sel !== autoPeriod()
            ? 'Период выбран вручную'
            : `По дате: ${monthTitle(key)}`;
          renderLimit();
        }

        // Подсказка: сколько осталось по лимиту категории в выбранном периоде
        function renderLimit() {
          const el = form.querySelector('[data-limit]');
          const catId = form.querySelector('input[name=categoryId]:checked').value;
          const key = monthKey();
          const period = selectedPeriod();
          const limit = B.limitFor(key, catId, period);
          if (!limit) { el.innerHTML = ''; el.className = 'limit-hint'; return null; }
          let spent = B.categorySpent(key, catId, period);
          if (editing && B.expenseMonth(existing) === key && B.expensePeriod(existing) === period && existing.categoryId === catId) {
            spent -= existing.amount; // не считаем редактируемую трату дважды
          }
          const amount = App.ui.parseAmount(form.amount.value) || 0;
          const left = limit - spent - amount;
          const status = B.limitStatus(spent + amount, limit);
          el.className = 'limit-hint ' + status;
          el.innerHTML = left >= 0
            ? `После этой траты останется <b>${money(left)}</b> из ${money(limit)}`
            : `Превышение лимита на <b>${money(-left)}</b> (лимит ${money(limit)})`;
          return { limit, left, status };
        }

        renderPeriods();

        periodsEl.addEventListener('change', e => {
          chosenPeriod = e.target.value;
          manual = chosenPeriod !== autoPeriod();
          renderPeriods();
        });
        form.date.addEventListener('change', () => {
          if (manual && !B.periods(monthKey()).some(p => p.type === chosenPeriod)) manual = false;
          renderPeriods();
        });
        form.querySelectorAll('input[name=categoryId]').forEach(r => r.addEventListener('change', renderLimit));
        form.amount.addEventListener('input', renderLimit);

        form.addEventListener('submit', e => {
          e.preventDefault();
          const errEl = form.querySelector('[data-error]');
          const amount = App.ui.parseAmount(form.amount.value);
          if (!(amount > 0)) {
            errEl.textContent = 'Введите сумму больше нуля';
            errEl.hidden = false;
            form.amount.focus();
            return;
          }
          if (!form.date.value) {
            errEl.textContent = 'Укажите дату';
            errEl.hidden = false;
            return;
          }

          // Предупреждение о превышении лимита (не запрет)
          const info = renderLimit();
          const catName = (cats.find(c => c.id === form.querySelector('input[name=categoryId]:checked').value) || {}).name;
          if (info && info.left < 0) {
            const ok = confirm(`Превышение лимита «${catName}» (${B.TYPES[selectedPeriod()]}) на ${money(-info.left)}.\n\nВсё равно ${editing ? 'сохранить' : 'добавить'}?`);
            if (!ok) return;
          }

          const record = {
            id: editing ? existing.id : App.utils.uid(),
            amount,
            categoryId: form.querySelector('input[name=categoryId]:checked').value,
            date: form.date.value,
            comment: form.comment.value.trim(),
            periodManual: manual,
            monthKey: monthKey(),
            period: selectedPeriod()
          };
          // Связь с регулярным платежом сохраняется при редактировании
          if (editing && existing.recurringKey) {
            record.recurringId = existing.recurringId;
            record.recurringKey = existing.recurringKey;
          }

          close();
          App.store.update(d => {
            if (editing) {
              const i = d.expenses.findIndex(x => x.id === record.id);
              d.expenses[i] = record;
            } else {
              d.expenses.push(record);
            }
            if (opts.onSave) opts.onSave(d, record);
            else d.settings.lastCategoryId = record.categoryId;
          });
          if (info && info.status === 'warn') {
            toast(`«${catName}»: осталось ${money(info.left)} из ${money(info.limit)}`);
          } else if (info && info.status === 'over') {
            toast(`«${catName}»: лимит превышен на ${money(-info.left)}`);
          } else {
            toast(editing ? 'Трата сохранена' : `Добавлено: ${money(amount)}`);
          }
        });

        const del = form.querySelector('[data-delete]');
        if (del) {
          del.addEventListener('click', () => {
            if (!confirm('Удалить эту трату?')) return;
            close();
            App.store.update(d => {
              d.expenses = d.expenses.filter(x => x.id !== existing.id);
              // Платёж «с подтверждением» снова появится в списке «К оплате»
              const rec = existing.recurringId && d.recurring.find(r => r.id === existing.recurringId);
              if (rec && rec.mode === 'confirm') delete d.recurringLog[existing.recurringKey];
            });
            toast('Трата удалена');
          });
        }

        if (!editing) setTimeout(() => form.amount.focus(), 250);
      }
    });
  }

  return { open };
})();

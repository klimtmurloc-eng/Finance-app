// Форма добавления / редактирования дохода (аванс, зарплата, прочее)
App.incomeForm = (function () {
  const { esc, isoDate, monthTitle, toast, money } = App.utils;
  const B = App.budget;

  // open() — новый доход; open(income) — редактирование
  function open(existing, presetType) {
    const editing = !!existing;
    const init = existing || {
      type: presetType || 'salary',
      amount: '',
      date: isoDate(),
      comment: '',
      monthKey: null
    };

    const html = `
      <form class="form" novalidate>
        <div class="segmented" role="radiogroup" aria-label="Тип дохода">
          ${Object.keys(B.TYPES).map(t => `
            <label><input type="radio" name="type" value="${t}" ${t === init.type ? 'checked' : ''}><span>${B.TYPES[t]}</span></label>
          `).join('')}
        </div>

        <label class="field">
          <span>Сумма</span>
          <input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(init.amount)}" class="input-amount">
        </label>

        <label class="field">
          <span>Дата поступления</span>
          <input name="date" type="date" value="${esc(init.date)}" required>
        </label>

        <label class="field">
          <span>Комментарий <em class="muted">(необязательно)</em></span>
          <input name="comment" maxlength="80" placeholder="Например: премия" value="${esc(init.comment)}">
        </label>

        <label class="field">
          <span>Месяц бюджета</span>
          <select name="monthKey"></select>
        </label>

        <p class="hint" data-preview></p>
        <p class="error" data-error hidden></p>

        <button class="btn btn-block" type="submit">${editing ? 'Сохранить' : 'Зачислить'}</button>
        ${editing ? '<button class="btn btn-danger btn-block" type="button" data-delete>Удалить доход</button>' : ''}
      </form>`;

    App.ui.sheet({
      title: editing ? 'Доход' : 'Новый доход',
      html,
      onMount(body, close) {
        const form = body.querySelector('form');
        const monthSel = form.monthKey;
        let monthTouched = editing; // при редактировании месяц не подбираем заново

        function currentType() {
          return form.querySelector('input[name=type]:checked').value;
        }

        // Заполняем список месяцев вокруг подходящего
        function fillMonths(selected) {
          const opts = [-1, 0, 1].map(n => B.shiftMonth(selected, n));
          monthSel.innerHTML = opts.map(k =>
            `<option value="${k}" ${k === selected ? 'selected' : ''}>${monthTitle(k)}</option>`).join('');
        }

        function refresh() {
          const type = currentType();
          const date = form.date.value || isoDate();
          if (!monthTouched) fillMonths(B.suggestMonth(type, date));
          const key = monthSel.value;
          const period = type === 'other' ? B.periodForDate(key, date) : type;
          form.querySelector('[data-preview]').innerHTML =
            `Зачислится в <b>${monthTitle(key)}</b>, период «${B.TYPES[period]}»`;
        }

        fillMonths(init.monthKey || B.suggestMonth(init.type, init.date));
        refresh();

        form.addEventListener('change', e => {
          if (e.target === monthSel) monthTouched = true;
          refresh();
        });
        form.date.addEventListener('input', refresh);

        form.addEventListener('submit', e => {
          e.preventDefault();
          const amount = App.ui.parseAmount(form.amount.value);
          const errEl = form.querySelector('[data-error]');
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

          const record = {
            id: editing ? existing.id : App.utils.uid(),
            type: currentType(),
            amount,
            date: form.date.value,
            comment: form.comment.value.trim(),
            monthKey: monthSel.value
          };

          close();
          App.store.update(d => {
            if (editing) {
              const i = d.incomes.findIndex(x => x.id === record.id);
              d.incomes[i] = record;
            } else {
              d.incomes.push(record);
            }
          });
          toast(editing ? 'Доход обновлён' : `Зачислено ${money(amount)}`);
        });

        const del = form.querySelector('[data-delete]');
        if (del) {
          del.addEventListener('click', () => {
            if (!confirm('Удалить этот доход?')) return;
            close();
            App.store.update(d => { d.incomes = d.incomes.filter(x => x.id !== existing.id); });
            toast('Доход удалён');
          });
        }

        if (!editing) setTimeout(() => form.amount.focus(), 250);
      }
    });
  }

  return { open };
})();

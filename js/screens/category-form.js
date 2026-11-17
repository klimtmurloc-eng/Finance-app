// Форма создания / редактирования категории и её лимитов
App.categoryForm = (function () {
  const { esc, monthTitle, toast } = App.utils;
  const B = App.budget;

  const ICONS = ['🛒', '🍔', '☕', '🚗', '🚌', '⛽', '🏠', '💡', '📱', '💊',
    '👕', '🎁', '🎬', '✈️', '🐾', '📚', '💇', '🏋️', '🧒', '💳', '🎮', '📦'];
  const COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#dc2626',
    '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#475569'];

  // monthKey — месяц, с которого действуют введённые лимиты
  function open(monthKey, existing) {
    const editing = !!existing;
    const cat = existing || { name: '', icon: ICONS[0], color: COLORS[0] };
    const periods = B.periods(monthKey);
    const limitValue = p => {
      if (!editing) return '';
      const v = B.limitFor(monthKey, cat.id, p.type);
      return v ? String(v) : '';
    };

    const html = `
      <form class="form" novalidate>
        <label class="field">
          <span>Название</span>
          <input name="name" maxlength="40" placeholder="Например: Продукты" value="${esc(cat.name)}" autocomplete="off">
        </label>

        <div class="field">
          <span>Иконка</span>
          <div class="pick-grid">
            ${ICONS.map(i => `<label class="pick"><input type="radio" name="icon" value="${i}" ${i === cat.icon ? 'checked' : ''}><span>${i}</span></label>`).join('')}
          </div>
        </div>

        <div class="field">
          <span>Цвет</span>
          <div class="pick-grid colors">
            ${COLORS.map(c => `<label class="pick"><input type="radio" name="color" value="${c}" ${c === cat.color ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}
          </div>
        </div>

        <div class="field">
          <span>Лимиты</span>
          <div class="limit-inputs">
            ${periods.map(p => `
              <label class="limit-input">
                <span class="small"><b>${p.title}</b> <span class="muted">${B.shortDate(p.start)} – ${B.shortDate(p.end)}</span></span>
                <input name="limit-${p.type}" inputmode="decimal" placeholder="Без лимита" value="${esc(limitValue(p))}" autocomplete="off">
              </label>`).join('')}
          </div>
          <p class="hint" style="margin:2px 0 0">Лимиты действуют с месяца «${monthTitle(monthKey)}» и переходят во все следующие месяцы, пока вы их не измените.</p>
        </div>

        <p class="error" data-error hidden></p>
        <button class="btn btn-block" type="submit">${editing ? 'Сохранить' : 'Создать категорию'}</button>
        ${editing ? '<button class="btn btn-danger btn-block" type="button" data-delete>Удалить категорию</button>' : ''}
      </form>`;

    App.ui.sheet({
      title: editing ? 'Категория' : 'Новая категория',
      html,
      onMount(body, close) {
        const form = body.querySelector('form');
        const errEl = form.querySelector('[data-error]');
        const fail = (msg, input) => { errEl.textContent = msg; errEl.hidden = false; if (input) input.focus(); };

        form.addEventListener('submit', e => {
          e.preventDefault();
          const name = form.name.value.trim();
          if (!name) return fail('Введите название', form.name);

          const dup = App.store.get().categories.some(c =>
            !c.archived && c.name.toLowerCase() === name.toLowerCase() && (!editing || c.id !== cat.id));
          if (dup) return fail('Категория с таким названием уже есть', form.name);

          // Разбираем лимиты: пусто = без лимита (0)
          const limits = {};
          for (const p of periods) {
            const input = form['limit-' + p.type];
            const raw = input.value.trim();
            if (raw === '') { limits[p.type] = 0; continue; }
            const v = App.ui.parseAmount(raw);
            if (!(v >= 0)) return fail(`Неверная сумма лимита для периода «${p.title}»`, input);
            limits[p.type] = v;
          }

          const id = editing ? cat.id : App.utils.uid();
          close();
          App.store.update(d => {
            const fields = {
              name,
              icon: form.querySelector('input[name=icon]:checked').value,
              color: form.querySelector('input[name=color]:checked').value
            };
            if (editing) {
              Object.assign(d.categories.find(c => c.id === id), fields);
            } else {
              d.categories.push(Object.assign({ id, archived: false, createdAt: monthKey }, fields));
            }
            // Записываем лимит только если он изменился, чтобы не трогать будущие месяцы зря
            Object.keys(limits).forEach(period => {
              if (!editing || B.limitFor(monthKey, id, period) !== limits[period]) {
                B.setLimit(d, monthKey, id, period, limits[period]);
              }
            });
          });
          toast(editing ? 'Категория сохранена' : 'Категория создана');
        });

        const del = form.querySelector('[data-delete]');
        if (del) {
          del.addEventListener('click', () => {
            const used = App.store.get().expenses.some(x => x.categoryId === cat.id);
            const msg = used
              ? 'В категории есть траты. Категория будет скрыта, а её траты останутся в истории и статистике. Продолжить?'
              : 'Удалить категорию и её лимиты?';
            if (!confirm(msg)) return;
            close();
            App.store.update(d => {
              if (used) {
                d.categories.find(c => c.id === cat.id).archived = true;
              } else {
                d.categories = d.categories.filter(c => c.id !== cat.id);
                Object.keys(d.limits).forEach(k => {
                  delete d.limits[k][cat.id];
                  if (!Object.keys(d.limits[k]).length) delete d.limits[k];
                });
              }
            });
            toast('Категория удалена');
          });
        }

        if (!editing) setTimeout(() => form.name.focus(), 250);
      }
    });
  }

  return { open };
})();

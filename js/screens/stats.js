// Экран статистики: графики на SVG без библиотек. Адрес: #/stats или #/stats/2026-12
(function () {
  const SERIES_INCOME = '#2a78d6'; // синий — доходы
  const SERIES_SPENT = '#eb6834';  // оранжевый — траты
  const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  // Компактные суммы для подписей осей: 25000 -> "25 тыс."
  function compact(n) {
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн';
    if (a >= 1000) return (n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' тыс.';
    return String(Math.round(n));
  }

  // «Красивые» деления оси от 0 до max
  function ticks(max, count) {
    if (!(max > 0)) return [0, 1];
    const raw = max / (count || 4);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw);
    const list = [];
    for (let v = 0; v <= max + step * 0.001; v += step) list.push(v);
    if (list[list.length - 1] < max) list.push(list[list.length - 1] + step);
    return list;
  }

  // Подсказка при наведении / касании
  function attachTooltip(wrap, items, hitSelector) {
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    wrap.appendChild(tip);
    function show(idx, evt) {
      const item = items[idx];
      if (!item) return;
      tip.innerHTML = item.html;
      tip.hidden = false;
      const box = wrap.getBoundingClientRect();
      let x = (evt.clientX || box.left + box.width / 2) - box.left;
      x = Math.max(70, Math.min(box.width - 70, x));
      tip.style.left = x + 'px';
      tip.style.top = Math.max(0, (evt.clientY || box.top) - box.top - 12) + 'px';
      wrap.querySelectorAll(hitSelector).forEach(el => el.classList.toggle('hot', +el.dataset.i === idx));
    }
    function hide() {
      tip.hidden = true;
      wrap.querySelectorAll(hitSelector).forEach(el => el.classList.remove('hot'));
    }
    wrap.querySelectorAll(hitSelector).forEach(el => {
      el.addEventListener('pointerenter', e => show(+el.dataset.i, e));
      el.addEventListener('pointermove', e => show(+el.dataset.i, e));
      el.addEventListener('pointerdown', e => show(+el.dataset.i, e));
    });
    wrap.addEventListener('pointerleave', hide);
    return { show, hide };
  }

  // ---------- 1. Траты по категориям: кольцо + рейтинг ----------
  function donutCard(key, B, money, esc) {
    const rows = B.categoryBreakdown(key).filter(r => r.spent > 0);
    const total = rows.reduce((s, r) => s + r.spent, 0);
    if (!total) return { html: emptyCard('Траты по категориям', 'В этом месяце трат пока нет.') };

    // Больше 7 категорий — остальные сворачиваем в «Другое»
    let parts = rows.map(r => ({ name: r.category.name, icon: r.category.icon, color: r.category.color, value: r.spent, id: r.category.id }));
    if (parts.length > 8) {
      const rest = parts.slice(7);
      parts = parts.slice(0, 7).concat([{ name: 'Другое', icon: '…', color: '#8a8f8c', value: rest.reduce((s, p) => s + p.value, 0) }]);
    }

    const R = 70, r = 46, C = 90;
    let angle = -Math.PI / 2;
    const arcs = parts.map((p, i) => {
      const a = (p.value / total) * Math.PI * 2;
      const a0 = angle, a1 = angle + a;
      angle = a1;
      if (parts.length === 1) {
        return `<g class="hit" data-i="${i}"><circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="${p.color}" stroke-width="${R - r}"/></g>`;
      }
      const large = a > Math.PI ? 1 : 0;
      const pt = (rad, ang) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)].map(n => n.toFixed(2)).join(' ');
      const d = `M ${pt(R, a0)} A ${R} ${R} 0 ${large} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${large} 0 ${pt(r, a0)} Z`;
      return `<path class="hit seg" data-i="${i}" d="${d}" fill="${p.color}" stroke="var(--surface)" stroke-width="2"/>`;
    }).join('');

    const list = parts.map((p, i) => {
      const pct = Math.round(p.value / total * 100);
      return `<li class="rank-row hit" data-i="${i}">
        <span class="swatch" style="background:${p.color}"></span>
        <span class="rank-name">${p.icon} ${esc(p.name)}</span>
        <span class="rank-val"><b>${money(p.value)}</b> <span class="muted">${pct}%</span></span>
        <span class="rank-bar"><span style="width:${Math.max(2, p.value / parts[0].value * 100)}%; background:${p.color}"></span></span>
      </li>`;
    }).join('');

    return {
      html: `<div class="card chart-card" data-chart="donut">
        <h3 class="card-title">Траты по категориям</h3>
        <div class="chart-wrap donut-wrap">
          <svg viewBox="0 0 180 180" class="donut" role="img" aria-label="Доли трат по категориям">
            ${arcs}
            <text x="${C}" y="${C - 2}" text-anchor="middle" class="donut-total">${compact(total)}</text>
            <text x="${C}" y="${C + 15}" text-anchor="middle" class="donut-sub">₽ потрачено</text>
          </svg>
        </div>
        <ul class="rank-list">${list}</ul>
      </div>`,
      tips: parts.map(p => ({ html: `<b>${esc(p.name)}</b><br>${money(p.value)} · ${Math.round(p.value / total * 100)}%` })),
      link: parts
    };
  }

  // ---------- 2. Доходы и траты за 6 месяцев ----------
  function monthsCard(key, B, money, monthTitle) {
    const keys = [];
    for (let i = 5; i >= 0; i--) keys.push(B.shiftMonth(key, -i));
    const data = keys.map(k => { const s = B.summary(k); return { k, income: s.income, spent: s.spent, left: s.left }; });
    const max = Math.max(...data.map(d => Math.max(d.income, d.spent)));
    if (!max) return { html: emptyCard('Доходы и траты по месяцам', 'Пока нет данных за последние месяцы.') };

    const W = 340, H = 200, L = 56, Rr = 6, T = 10, Bm = 26;
    const tk = ticks(max, 4), top = tk[tk.length - 1];
    const y = v => T + (H - T - Bm) * (1 - v / top);
    const slot = (W - L - Rr) / data.length, bw = Math.min(16, slot / 3);
    const bar = (x, v, color) => {
      const h = Math.max(0, y(0) - y(v));
      if (h < 0.5) return '';
      const rad = Math.min(4, h);
      return `<path d="M${x} ${y(0)} V${y(v) + rad} Q${x} ${y(v)} ${x + rad} ${y(v)} H${x + bw - rad} Q${x + bw} ${y(v)} ${x + bw} ${y(v) + rad} V${y(0)} Z" fill="${color}"/>`;
    };
    const grid = tk.map(v => `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" class="grid"/>
      <text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${compact(v)}</text>`).join('');
    const groups = data.map((d, i) => {
      const cx = L + slot * i + slot / 2;
      const m = Number(d.k.slice(5)) - 1;
      return `<g>
        ${bar(cx - bw - 1, d.income, SERIES_INCOME)}
        ${bar(cx + 1, d.spent, SERIES_SPENT)}
        <text x="${cx}" y="${H - 8}" text-anchor="middle" class="axis ${d.k === key ? 'axis-strong' : ''}">${SHORT_MONTHS[m]}</text>
        <rect class="hit col" data-i="${i}" x="${L + slot * i}" y="${T}" width="${slot}" height="${H - T - Bm}" fill="transparent"/>
      </g>`;
    }).join('');

    return {
      html: `<div class="card chart-card" data-chart="months">
        <h3 class="card-title">Доходы и траты по месяцам</h3>
        <div class="legend small"><span><i style="background:${SERIES_INCOME}"></i>Доходы</span><span><i style="background:${SERIES_SPENT}"></i>Траты</span></div>
        <div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Доходы и траты за 6 месяцев">${grid}${groups}</svg></div>
      </div>`,
      tips: data.map(d => ({ html: `<b>${monthTitle(d.k)}</b><br>Доходы: ${money(d.income)}<br>Траты: ${money(d.spent)}<br>Итог: ${money(d.left)}` }))
    };
  }

  // ---------- 3. Накопленные траты по дням ----------
  function dailyCard(key, B, money) {
    const s = B.summary(key);
    const range = B.monthRange(key);
    const today = App.utils.isoDate();
    const days = [];
    for (let d = range.start; d <= range.end; d = B.addDays(d, 1)) days.push(d);
    const lastDay = today < range.start ? null : (today < range.end ? today : range.end);
    if (!lastDay) return { html: emptyCard('Траты по дням', 'Этот месяц ещё не начался.') };

    const perDay = {};
    B.expensesOf(key).forEach(e => { perDay[e.date] = (perDay[e.date] || 0) + e.amount; });
    let acc = 0;
    const pts = days.filter(d => d <= lastDay).map(d => { acc += perDay[d] || 0; return { d, v: acc, day: perDay[d] || 0 }; });
    const budget = s.carry + s.income;
    const max = Math.max(acc, budget, 1);

    const W = 340, H = 190, L = 56, Rr = 8, T = 12, Bm = 24;
    const tk = ticks(max, 4), top = tk[tk.length - 1];
    const x = i => L + (W - L - Rr) * (days.length > 1 ? i / (days.length - 1) : 0);
    const y = v => T + (H - T - Bm) * (1 - v / top);
    const grid = tk.map(v => `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" class="grid"/>
      <text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${compact(v)}</text>`).join('');
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const area = `${line} L${x(pts.length - 1).toFixed(1)} ${y(0)} L${x(0)} ${y(0)} Z`;
    const labelIdx = [0, Math.floor((days.length - 1) / 2), days.length - 1];
    const xLabels = labelIdx.map((i, n) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${n === 0 ? 'start' : n === 2 ? 'end' : 'middle'}" class="axis">${B.shortDate(days[i])}</text>`).join('');
    const budgetLine = budget > 0 ? `<line x1="${L}" x2="${W - Rr}" y1="${y(budget)}" y2="${y(budget)}" class="ref-line"/>
      <text x="${W - Rr}" y="${y(budget) - 5}" text-anchor="end" class="axis">бюджет ${compact(budget)}</text>` : '';
    const last = pts[pts.length - 1];
    const hits = pts.map((p, i) => {
      const w = (W - L - Rr) / Math.max(1, days.length - 1);
      return `<rect class="hit" data-i="${i}" x="${x(i) - w / 2}" y="${T}" width="${w}" height="${H - T - Bm}" fill="transparent"/>`;
    }).join('');
    const avg = acc / pts.length;

    return {
      html: `<div class="card chart-card" data-chart="daily">
        <h3 class="card-title">Траты по дням</h3>
        <p class="small muted" style="margin:0 0 6px">Накопленная сумма с начала месяца · в среднем ${money(Math.round(avg))} в день</p>
        <div class="chart-wrap">
          <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Накопленные траты по дням">
            ${grid}${budgetLine}
            <path d="${area}" fill="${SERIES_SPENT}" opacity=".10"/>
            <path d="${line}" fill="none" stroke="${SERIES_SPENT}" stroke-width="2" stroke-linejoin="round"/>
            <circle cx="${x(pts.length - 1)}" cy="${y(last.v)}" r="4" fill="${SERIES_SPENT}" stroke="var(--surface)" stroke-width="2"/>
            <line class="crosshair" x1="0" x2="0" y1="${T}" y2="${H - Bm}" style="display:none"/>
            ${xLabels}${hits}
          </svg>
        </div>
      </div>`,
      tips: pts.map(p => ({ html: `<b>${B.shortDate(p.d)}</b><br>За день: ${money(p.day)}<br>С начала месяца: ${money(p.v)}` })),
      crosshair: pts.map((p, i) => x(i))
    };
  }

  // ---------- 4. Зарплата и аванс ----------
  function periodsCard(key, B, money) {
    const s = B.summary(key);
    const today = App.utils.isoDate();
    const rows = s.periods.map(p => {
      const days = Math.round((B.parse(p.end) - B.parse(p.start)) / 86400000) + 1;
      const pct = p.available > 0 ? Math.min(100, Math.round(p.spent / p.available * 100)) : (p.spent > 0 ? 100 : 0);
      const status = p.available > 0 ? B.limitStatus(p.spent, p.available) : (p.spent > 0 ? 'over' : 'ok');
      const passed = today < p.start ? 0 : Math.min(days, Math.round((B.parse(today < p.end ? today : p.end) - B.parse(p.start)) / 86400000) + 1);
      return `<div class="period-meter">
        <div class="limit-line-head period-meter-head">
          <span><b>${p.title}</b><br><span class="small muted">${B.shortDate(p.start)} – ${B.shortDate(p.end)}</span></span>
          <span class="small" style="text-align:right"><b>${money(p.spent)}</b><br><span class="muted">из ${money(p.available)}</span></span>
        </div>
        <div class="progress"><div class="bar-${status}" style="width:${pct}%"></div></div>
        <div class="period-meter-foot small muted">
          <span>${days} дн. · ${passed ? 'в среднем ' + money(Math.round(p.spent / passed)) + ' в день' : 'ещё не начался'}</span>
          <span class="${p.left < 0 ? 'st-over' : ''}">${p.left < 0 ? 'перерасход ' + money(-p.left) : 'осталось ' + money(p.left)}</span>
        </div>
      </div>`;
    }).join('');
    return {
      html: `<div class="card chart-card">
        <h3 class="card-title">Зарплата и аванс</h3>
        <div class="period-meters">${rows}</div>
      </div>`
    };
  }

  function emptyCard(title, text) {
    return `<div class="card chart-card"><h3 class="card-title">${title}</h3><p class="muted small" style="margin:0">${text}</p></div>`;
  }

  App.router.register('stats', {
    title: 'Статистика',
    render(el, params) {
      const { money, esc, monthTitle } = App.utils;
      const B = App.budget;
      const key = App.ui.monthFromParams(params);
      const s = B.summary(key);

      const donut = donutCard(key, B, money, esc);
      const months = monthsCard(key, B, money, monthTitle);
      const daily = dailyCard(key, B, money);
      const periods = periodsCard(key, B, money);

      el.innerHTML = `
        ${App.ui.monthSwitch('stats', key)}
        <div class="stat-tiles">
          <div class="card stat-tile"><span class="small muted">Доходы</span><b>${money(s.income)}</b></div>
          <div class="card stat-tile"><span class="small muted">Траты</span><b>${money(s.spent)}</b></div>
          <div class="card stat-tile"><span class="small muted">Итог</span><b class="${s.left < 0 ? 'neg' : ''}">${money(s.left)}</b></div>
        </div>
        ${donut.html}
        ${periods.html}
        ${daily.html}
        ${months.html}
      `;

      // Подсказки
      const donutEl = el.querySelector('[data-chart=donut]');
      if (donutEl && donut.tips) {
        attachTooltip(donutEl, donut.tips, '.hit');
        donutEl.querySelectorAll('.rank-row').forEach(row => row.addEventListener('click', () => {
          const part = donut.link[+row.dataset.i];
          if (!part.id) return;
          App.expensesFilter.categoryId = part.id;
          App.expensesFilter.period = 'all';
          App.expensesFilter.view = 'days';
          App.router.go('expenses/' + key);
        }));
      }
      const monthsEl = el.querySelector('[data-chart=months]');
      if (monthsEl && months.tips) attachTooltip(monthsEl.querySelector('.chart-wrap'), months.tips, '.hit');
      const dailyEl = el.querySelector('[data-chart=daily]');
      if (dailyEl && daily.tips) {
        const wrap = dailyEl.querySelector('.chart-wrap');
        const tip = attachTooltip(wrap, daily.tips, '.hit');
        const cross = wrap.querySelector('.crosshair');
        wrap.querySelectorAll('.hit').forEach(h => {
          const move = () => {
            const xx = daily.crosshair[+h.dataset.i];
            cross.setAttribute('x1', xx); cross.setAttribute('x2', xx); cross.style.display = '';
          };
          h.addEventListener('pointerenter', move);
          h.addEventListener('pointerdown', move);
        });
        wrap.addEventListener('pointerleave', () => { cross.style.display = 'none'; tip.hide(); });
      }
    }
  });
})();

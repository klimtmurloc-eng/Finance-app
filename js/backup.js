// Резервная копия: сохранение всех данных в файл .json и восстановление из него
App.backup = (function () {
  const REMIND_DAYS = 14;

  function fileName() {
    return 'finance-backup-' + App.utils.isoDate() + '.json';
  }

  function makeFile() {
    const payload = Object.assign({}, App.store.get(), { exportedAt: new Date().toISOString() });
    const json = JSON.stringify(payload, null, 2);
    return new File([json], fileName(), { type: 'application/json' });
  }

  function markDone() {
    App.store.update(d => { d.settings.lastBackupAt = new Date().toISOString(); });
  }

  // Скачать файл (на компьютере и Android — в «Загрузки», на iPhone — в «Файлы»)
  function download() {
    const file = makeFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    markDone();
    App.utils.toast('Копия сохранена: ' + file.name);
  }

  function canShare() {
    try {
      return !!(navigator.canShare && navigator.canShare({ files: [makeFile()] }));
    } catch (e) {
      return false;
    }
  }

  // Отправить файл через меню «Поделиться» (Telegram, почта, Google Диск и т.п.)
  async function share() {
    const file = makeFile();
    try {
      await navigator.share({ files: [file], title: 'Резервная копия «Финансы»' });
      markDone();
      App.utils.toast('Копия отправлена');
    } catch (e) {
      if (e.name !== 'AbortError') App.utils.toast('Не удалось поделиться файлом');
    }
  }

  // Короткое описание содержимого копии для подтверждения
  function describe(raw) {
    const n = (arr) => (Array.isArray(arr) ? arr.length : 0);
    const when = raw.exportedAt ? new Date(raw.exportedAt).toLocaleString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'неизвестно';
    return `Копия от: ${when}\nКатегорий: ${n((raw.categories || []).filter(c => !c.archived))}\nТрат: ${n(raw.expenses)}\nДоходов: ${n(raw.incomes)}`;
  }

  // Восстановление из выбранного файла
  function restore(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let raw;
      try {
        raw = JSON.parse(reader.result);
      } catch (e) {
        alert('Не удалось прочитать файл: это не файл резервной копии.');
        return;
      }
      const err = App.store.validate(raw);
      if (err) {
        alert('Не удалось восстановить: ' + err + '.');
        return;
      }
      const ok = confirm(describe(raw) +
        '\n\nТекущие данные на этом устройстве будут заменены данными из копии. Продолжить?');
      if (!ok) return;
      App.store.replace(raw);
      // Раз копия есть в файле — считаем её последней сделанной
      App.store.update(d => { d.settings.lastBackupAt = raw.exportedAt || new Date().toISOString(); });
      App.utils.toast('Данные восстановлены');
    };
    reader.onerror = () => alert('Не удалось прочитать файл.');
    reader.readAsText(file);
  }

  // Сколько дней назад была последняя копия (null — ни разу)
  function daysSinceLast() {
    const last = App.store.get().settings.lastBackupAt;
    if (!last) return null;
    return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
  }

  // Нужно ли напомнить: есть данные, а копии нет или она старая
  function needsReminder() {
    const d = App.store.get();
    if (!d.expenses.length && !d.incomes.length) return false;
    const days = daysSinceLast();
    return days == null || days >= REMIND_DAYS;
  }

  return { download, share, canShare, restore, daysSinceLast, needsReminder, REMIND_DAYS };
})();

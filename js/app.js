// Точка входа: загружаем данные и запускаем роутер
(function () {
  App.store.load();
  App.pwa.init();
  App.store.save(); // создаём запись при первом запуске

  // Автоматические регулярные платежи: проверяем при запуске и при возврате в приложение
  function runRecurring() {
    const created = App.recurring.process();
    if (created.length) App.utils.toast('Записаны регулярные платежи: ' + created.join(', '));
  }
  runRecurring();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runRecurring();
  });

  App.router.start();
  document.getElementById('fab').addEventListener('click', () => App.expenseForm.open());
})();

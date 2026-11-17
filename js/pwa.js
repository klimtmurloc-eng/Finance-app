// Установка на главный экран, работа офлайн и защита данных от очистки
App.pwa = (function () {
  const VERSION = '1.0.0';
  let installEvent = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function init() {
    // Service Worker работает только с сервера (https), не из файла на компьютере
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW не зарегистрирован', e));
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Пришла новая версия приложения — перезагружаем один раз
        if (hadController && !reloaded) { reloaded = true; location.reload(); }
      });
    }

    // Android/Chrome: можно показать свою кнопку «Установить»
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      installEvent = e;
      if (location.hash.startsWith('#/settings')) App.router.render();
    });
    window.addEventListener('appinstalled', () => {
      installEvent = null;
      App.utils.toast('Приложение установлено');
    });

    // Просим браузер не удалять данные при нехватке места
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist(); }).catch(() => {});
    }
  }

  async function install() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    App.router.render();
  }

  // Что показать в настройках
  function installState() {
    if (isStandalone()) return 'installed';
    if (installEvent) return 'prompt';
    if (isIOS()) return 'ios';
    return 'manual';
  }

  return { init, install, installState, VERSION };
})();

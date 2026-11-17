// Простой роутер на основе адреса после # (например, #/expenses)
App.router = (function () {
  const screens = {};
  const DEFAULT = 'home';

  // Каждый экран регистрирует себя: { title, render(container, params) }
  function register(name, screen) {
    screens[name] = screen;
  }

  function parse() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [name, ...params] = hash.split('/');
    return { name: screens[name] ? name : DEFAULT, params };
  }

  function render() {
    const { name, params } = parse();
    const screen = screens[name];
    const container = document.getElementById('screen');

    document.body.dataset.route = name;
    document.getElementById('screen-title').textContent = screen.title;
    document.title = screen.title + ' — Финансы';

    document.querySelectorAll('.tab').forEach(tab => {
      const active = tab.dataset.route === name;
      tab.classList.toggle('active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });

    container.innerHTML = '';
    screen.render(container, params);
    window.scrollTo(0, 0);
  }

  function go(path) {
    location.hash = '#/' + path;
  }

  function start() {
    window.addEventListener('hashchange', render);
    // Перерисовываем текущий экран при изменении данных
    App.store.subscribe(render);
    render();
  }

  return { register, start, go, render };
})();

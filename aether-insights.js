/* Visit counts for this site, by Aether. Anonymous: no cookies, no personal data. */
(function () {
  var C = {"site":"t_f03840c68a4044f0e0","project":"vybe-6b650","key":"AIzaSyCHtl7BQSQejrQjmLa7W_ysxZit46Cdt3A","ab":null};
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  var visitor = 'anon';
  try {
    visitor = localStorage.getItem('_vybe_v') || '';
    if (!visitor) { visitor = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('_vybe_v', visitor); }
  } catch (e) { visitor = 'anon'; }
  var params = new URLSearchParams(location.search);
  var source = (params.get('utm_source') || params.get('ref') || '').slice(0, 100);
  var referrer = '';
  try { var r = document.referrer && new URL(document.referrer); if (r && r.host !== location.host) referrer = r.host.slice(0, 200); } catch (e) {}
  var db = 'projects/' + C.project + '/databases/(default)/documents';
  // In an A/B test, the variant is the copy under its folder; every other page is the control.
  var inVariant = !!(C.ab && location.pathname.indexOf(C.ab.prefix) === 0);
  function id() { var s = '', a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; for (var i = 0; i < 20; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function str(v) { return { stringValue: v }; }
  function send(kind, label) {
    var fields = { site: str(C.site), kind: str(kind), path: str(page()), ref: str(referrer), src: str(source), v: str(visitor.slice(0, 40)) };
    if (label) fields.label = str(label);
    if (C.ab) fields.x = str(C.ab.id + ':' + (inVariant ? 'b' : 'a'));
    var body = { writes: [{
      update: { name: db + '/vybe_site_events/' + id(), fields: fields },
      updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }],
      currentDocument: { exists: false }
    }] };
    try {
      fetch('https://firestore.googleapis.com/v1/' + db + ':commit?key=' + C.key, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(function () {});
    } catch (e) {}
  }
  var last = '';
  // The page: its path, plus a #/screen route when the app uses one for separate screens.
  function page() {
    var h = location.hash || '';
    var path = inVariant ? '/' + location.pathname.slice(C.ab.prefix.length) : location.pathname;
    return (path + (h.indexOf('#/') === 0 ? h.split('?')[0] : '')).slice(0, 200);
  }
  function view() { var p = page(); if (p === last) return; last = p; send('view'); }
  view();
  var push = history.pushState;
  history.pushState = function () { var out = push.apply(this, arguments); view(); return out; };
  window.addEventListener('popstate', view);
  window.addEventListener('hashchange', view);
  document.addEventListener('submit', function () { send('form'); }, true);
  // Key actions the app reports itself: window.vybe.track('Logged a run'). Once per name per page view burst.
  window.vybe = window.vybe || {};
  var lastAction = '', lastActionAt = 0;
  window.vybe.track = function (name) {
    name = String(name || '').replace(/s+/g, ' ').trim().slice(0, 80);
    var now = Date.now();
    if (!name || (name === lastAction && now - lastActionAt < 1000)) return;
    lastAction = name; lastActionAt = now;
    send('action', name);
  };
  // Button clicks, named by what the button says (or its aria-label). Never reads what people type.
  var lastClick = '', lastAt = 0;
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('button, a, [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], summary, [data-track]');
    if (!el) return;
    var name = el.getAttribute('data-track') || el.getAttribute('aria-label') || el.getAttribute('title') || (el.tagName === 'INPUT' ? (el.type === 'checkbox' ? 'Checkbox' : el.getAttribute('value')) : el.textContent) || el.id || el.tagName.toLowerCase();
    name = String(name).replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!name) return;
    var now = Date.now();
    if (name === lastClick && now - lastAt < 600) return;
    lastClick = name; lastAt = now;
    send('click', name);
  }, true);
})();

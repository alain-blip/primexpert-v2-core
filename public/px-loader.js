/**
 * Chargeur statique (non bundlé).
 * `/` → gate.ts (connexion Google au clic, zéro vendor au paint).
 * `/workhub`, `/acces-vendeur` → bootstrap-spa (cockpit React).
 */
(function () {
  var path = location.pathname;
  var isSpa =
    path === '/workhub' ||
    path.indexOf('/workhub/') === 0 ||
    path === '/acces-vendeur' ||
    path.indexOf('/acces-vendeur/') === 0;

  var src = isSpa ? '__PRIMEXPERT_BOOTSTRAP_SRC__' : '__PRIMEXPERT_GATE_SRC__';
  if (src.indexOf('__PRIMEXPERT') === 0) {
    src = isSpa ? '/src/bootstrap-spa.tsx' : '/src/gate.ts';
  }

  var el = document.createElement('script');
  el.type = 'module';
  el.src = src;
  document.body.appendChild(el);
})();

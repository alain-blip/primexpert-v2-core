/**
 * Chargeur SPA — fichier statique (non bundlé). Sur `/` : aucune action.
 * En prod, postbuild injecte l’URL du chunk bootstrap-spa.
 */
(function () {
  var path = location.pathname;
  var isSpa =
    path === '/workhub' ||
    path.indexOf('/workhub/') === 0 ||
    path === '/acces-vendeur' ||
    path.indexOf('/acces-vendeur/') === 0;
  if (!isSpa) return;

  var src = '__PRIMEXPERT_BOOTSTRAP_SRC__';
  if (src.indexOf('__PRIMEXPERT') === 0) {
    src = '/src/bootstrap-spa.tsx';
  }

  var el = document.createElement('script');
  el.type = 'module';
  el.src = src;
  document.body.appendChild(el);
})();

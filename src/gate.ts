/**
 * Point d'entrée léger V2.8 — page publique HTML statique, zéro chunk vendor au paint.
 */

const SPA_PATHS = ['/workhub', '/acces-vendeur'];

function isSpaPath(pathname: string): boolean {
  return SPA_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function setBusy(busy: boolean) {
  document.querySelectorAll<HTMLButtonElement>('[data-px-login]').forEach((btn) => {
    btn.disabled = busy;
  });
}

async function handleSignIn() {
  setBusy(true);
  try {
    const { runPublicSignIn } = await import('./auth-signin');
    const ok = await runPublicSignIn();
    if (ok) {
      window.location.replace('/workhub');
    }
  } catch {
    /* erreur déjà journalisée dans auth-signin */
  } finally {
    setBusy(false);
  }
}

function applyLanguage(lang: 'fr' | 'en') {
  document.documentElement.lang = lang === 'en' ? 'en-CA' : 'fr-CA';
  document.querySelectorAll<HTMLElement>('[data-i18n-fr]').forEach((node) => {
    const fr = node.dataset.i18nFr ?? '';
    const en = node.dataset.i18nEn ?? '';
    node.textContent = lang === 'en' ? en : fr;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-px-lang]').forEach((b) => {
    b.classList.toggle('px-lang-active', b.dataset.pxLang === lang);
  });
}

function bindStaticLanding() {
  try {
    const stored = localStorage.getItem('primexpert-language');
    if (stored === 'en') applyLanguage('en');
  } catch {
    /* mode privé */
  }

  document.querySelectorAll('[data-px-login]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      void handleSignIn();
    });
  });

  document.querySelectorAll('[data-px-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.pxLang;
      if (lang !== 'fr' && lang !== 'en') return;
      try {
        localStorage.setItem('primexpert-language', lang);
      } catch {
        /* mode privé */
      }
      applyLanguage(lang);
    });
  });
}

function loadSpa() {
  void import('./bootstrap-spa');
}

const { pathname } = window.location;

if (isSpaPath(pathname)) {
  loadSpa();
} else {
  bindStaticLanding();
}

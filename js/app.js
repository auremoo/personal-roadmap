import { isAuthenticated, mount as mountLock, PAT_KEY } from './views/lock.js';
import { mount as mountHome }        from './views/home.js';
import { mount as mountProjects }    from './views/projects.js';
import { mount as mountProject }     from './views/project.js';
import { mount as mountProjectForm } from './views/project-form.js';
import { mount as mountSettings }    from './views/settings.js';
import { mountSidebar }              from './views/sidebar.js';
import { initStore }                 from './store.js';
import { configure }                 from './github-api.js';

export { showToast } from './toast.js';

const app = document.getElementById('app');

export function navigate(path) {
  location.hash = path;
}

// ── Router ────────────────────────────────────────────────────────

const ROUTES = [
  { re: /^\/$/,                                                  fn: () => mountHome(app) },
  { re: /^\/projects$/,                                          fn: () => mountProjects(app) },
  { re: /^\/new-project$/,                                       fn: () => mountProjectForm(app, null) },
  { re: /^\/settings$/,                                          fn: () => mountSettings(app) },
  { re: /^\/project\/([\w-]+)$/,                                 fn: m => mountProject(app, m[1], 'plan') },
  { re: /^\/project\/([\w-]+)\/(plan|progress|versions|infos)$/, fn: m => mountProject(app, m[1], m[2]) },
  { re: /^\/project\/([\w-]+)\/edit$/,                           fn: m => mountProjectForm(app, m[1]) },
];

let _lastPath = '/';

async function route() {
  const path = decodeURIComponent(location.hash.slice(1)) || '/';
  _lastPath = path;
  refreshSidebar();
  app.scrollTop = 0;
  window.scrollTo(0, 0);
  for (const { re, fn } of ROUTES) {
    const m = path.match(re);
    if (m) { await fn(m); return; }
  }
  mountHome(app);
}

// Re-rend la sidebar (compteurs d'avancement) après une modification.
export function refreshSidebar() {
  mountSidebar(document.getElementById('sidebar'), _lastPath);
}

// ── Boot ──────────────────────────────────────────────────────────

async function boot() {
  if (!isAuthenticated()) {
    document.body.classList.add('is-locked');
    mountLock(app, () => boot());
    return;
  }
  document.body.classList.remove('is-locked');

  // Rafraîchissement de page : token en sessionStorage, coordonnées du dépôt dans config.json
  const token = sessionStorage.getItem(PAT_KEY);
  if (token) {
    try {
      const cfg = await fetch(`./config.json?_t=${Date.now()}`).then(r => r.json());
      configure({ token, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch || 'main' });
    } catch { /* initStore échouera avec un message clair */ }
  }

  app.innerHTML = `<div class="loading-state loading-state--full"><div class="spinner"></div><span>Chargement…</span></div>`;

  try {
    await initStore();
  } catch (err) {
    app.innerHTML = `
      <div class="loading-state loading-state--full">
        <div style="font-size:40px">⚠️</div>
        <div style="font-size:17px;font-weight:600">Erreur de connexion</div>
        <div class="muted" style="max-width:320px;text-align:center">${err.message}</div>
      </div>`;
    return;
  }

  // Tout élément [data-nav] navigue vers son chemin (un seul écouteur pour toute l'app).
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-nav]');
    if (el) { e.preventDefault(); navigate(el.dataset.nav); }
  });
  window.addEventListener('hashchange', route);
  await route();
}

document.addEventListener('DOMContentLoaded', boot);

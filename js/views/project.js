// Conteneur d'un projet : onglets Plan / Avancement / Versions / Infos.
// Mobile : barre d'onglets en bas. Ordinateur : onglets sous l'en-tête (même balisage, CSS différent).

import { getProjectMeta, ensurePlanLoaded } from '../store.js';
import { navigate } from '../app.js';
import { ICONS } from '../utils/ui.js';
import { topbar } from './chrome.js';
import { mount as mountPlan }     from './plan-view.js';
import { mount as mountProgress } from './progress-view.js';
import { mount as mountVersions } from './versions-view.js';
import { mount as mountInfos }    from './infos-view.js';

const TABS = [
  { id: 'plan',     label: 'Plan',       icon: 'plan' },
  { id: 'progress', label: 'Avancement', icon: 'progress' },
  { id: 'versions', label: 'Versions',   icon: 'versions' },
  { id: 'infos',    label: 'Infos',      icon: 'infos' },
];

export async function mount(container, slug, tab = 'plan') {
  const meta = getProjectMeta(slug);
  if (!meta) { navigate('/projects'); return; }
  if (meta.activeVersion) await ensurePlanLoaded(slug, meta.activeVersion);

  container.innerHTML = `
    <div class="view view--project">
      ${topbar({
        title: meta.name,
        subtitle: meta.activeVersion ? `Roadmap v${meta.activeVersion}` : 'Sans roadmap',
        back: { label: 'Projets', path: '/projects' },
      })}
      <nav class="tab-bar tab-bar--project">
        ${TABS.map(t => `
          <button class="tab-item ${t.id === tab ? 'tab-item--active' : ''}" data-nav="/project/${slug}/${t.id}">
            ${ICONS[t.icon]}<span>${t.label}</span>
          </button>`).join('')}
      </nav>
      <main class="page" id="tab-content"></main>
    </div>`;

  const content = container.querySelector('#tab-content');
  switch (tab) {
    case 'progress': mountProgress(content, slug); break;
    case 'versions': mountVersions(content, slug); break;
    case 'infos':    mountInfos(content, slug);    break;
    default:         mountPlan(content, slug);
  }
}

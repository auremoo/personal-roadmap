import { getFile, putFile } from './github-api.js';
import { parseRoadmap } from './parser.js';
import { showToast } from './toast.js';

// ── In-memory state ───────────────────────────────────────────────

const INDEX_PATH   = 'projects/index.json';
const STATE_PATH   = 'state.json';
const PROFILE_PATH = 'profile.json';

let _index      = [];   // entrées de projects/index.json
let _metas      = {};   // slug → meta.json
let _plans      = {};   // slug → { v: roadmap parsée }
let _planRaw    = {};   // slug → { v: texte .md brut }
let _state      = { version: 1, projects: {} };
let _profile    = {};
let _profileSha = null;
let _syncTimer  = null;
let _syncing    = false;

const metaPath = slug => `projects/${slug}/meta.json`;
const planPath = (slug, file) => `projects/${slug}/plans/${file}`;

// ── Init ──────────────────────────────────────────────────────────

export async function initStore() {
  const [indexFile, stateFile, profileFile] = await Promise.all([
    getFile(INDEX_PATH), getFile(STATE_PATH), getFile(PROFILE_PATH),
  ]);

  // Dépôt vierge : aucun fichier n'est obligatoire, ils sont créés au premier enregistrement.
  _index = indexFile ? (JSON.parse(indexFile.content).projects || []) : [];
  if (stateFile) {
    _state = JSON.parse(stateFile.content);
    if (!_state.projects) _state.projects = {};
  }
  if (profileFile) {
    _profile = JSON.parse(profileFile.content);
    _profileSha = profileFile.sha;
  }

  await Promise.all(_index.map(p => loadMeta(p.slug)));
  await Promise.all(_index.map(p => {
    const meta = _metas[p.slug];
    return meta?.activeVersion ? ensurePlanLoaded(p.slug, meta.activeVersion) : null;
  }));

  // Fermeture de l'onglet avant la fin d'un enregistrement : le navigateur demande confirmation.
  window.addEventListener('beforeunload', e => {
    if (_syncTimer || _syncing) { e.preventDefault(); e.returnValue = ''; }
  });

  // Sur mobile, l'app peut être fermée pendant le délai de synchro : on vide la file tout de suite.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && _syncTimer) {
      clearTimeout(_syncTimer);
      _syncTimer = null;
      syncState();
    }
  });
}

// ── Projets ───────────────────────────────────────────────────────

export function getProjects() { return _index; }

export function getProjectMeta(slug) { return _metas[slug] || null; }

async function loadMeta(slug) {
  if (_metas[slug]) return _metas[slug];
  const file = await getFile(metaPath(slug));
  if (!file) return null;
  _metas[slug] = JSON.parse(file.content);
  return _metas[slug];
}

function indexEntry(meta) {
  return {
    slug: meta.slug,
    name: meta.name,
    startDate: meta.startDate || '',
    endDate: meta.endDate || '',
    status: meta.status || 'active',
  };
}

async function writeIndex() {
  const file = await getFile(INDEX_PATH);
  await putFile(INDEX_PATH, JSON.stringify({ projects: _index }, null, 2), file?.sha || null);
}

export async function createProject(data) {
  if (_index.some(p => p.slug === data.slug)) throw new Error('Un projet avec cet identifiant existe déjà.');
  const meta = {
    ...data,
    status: 'active',
    createdAt: new Date().toISOString(),
    activeVersion: null,
    versions: [],
  };
  await putFile(metaPath(meta.slug), JSON.stringify(meta, null, 2), null);
  _metas[meta.slug] = meta;
  _index.push(indexEntry(meta));
  await writeIndex();
  return meta.slug;
}

export async function updateProject(slug, updates) {
  const meta = getProjectMeta(slug);
  if (!meta) throw new Error('Projet introuvable');
  const file = await getFile(metaPath(slug));
  const newMeta = { ...meta, ...updates, slug };
  await putFile(metaPath(slug), JSON.stringify(newMeta, null, 2), file?.sha || null);
  _metas[slug] = newMeta;

  const i = _index.findIndex(p => p.slug === slug);
  const entry = indexEntry(newMeta);
  const changed = i < 0 || JSON.stringify(_index[i]) !== JSON.stringify(entry);
  if (i < 0) _index.push(entry); else _index[i] = entry;
  if (changed) await writeIndex();
}

// ── Plans (versions de la roadmap) ────────────────────────────────

export async function ensurePlanLoaded(slug, version) {
  if (_plans[slug]?.[version]) return _plans[slug][version];
  const file = await getFile(planPath(slug, `v${version}.md`));
  if (!file) return null;
  cachePlan(slug, version, file.content);
  return _plans[slug][version];
}

function cachePlan(slug, version, md) {
  (_plans[slug] ||= {})[version] = parseRoadmap(md);
  (_planRaw[slug] ||= {})[version] = md;
}

export function getActivePlan(slug) {
  const v = getProjectMeta(slug)?.activeVersion;
  return v ? _plans[slug]?.[v] || null : null;
}

export function getActivePlanRaw(slug) {
  const v = getProjectMeta(slug)?.activeVersion;
  return v ? _planRaw[slug]?.[v] || null : null;
}

export async function getPlanRaw(slug, version) {
  await ensurePlanLoaded(slug, version);
  return _planRaw[slug]?.[version] || null;
}

export async function importPlanVersion(slug, md, label) {
  const meta = getProjectMeta(slug);
  if (!meta) throw new Error('Projet introuvable');
  const nextV = (meta.versions?.length ? Math.max(...meta.versions.map(v => v.v)) : 0) + 1;
  const file = `v${nextV}.md`;

  await putFile(planPath(slug, file), md, null);
  await updateProject(slug, {
    activeVersion: nextV,
    versions: [
      ...(meta.versions || []),
      { v: nextV, file, importedAt: new Date().toISOString(), label: label || `Version ${nextV}` },
    ],
  });
  cachePlan(slug, nextV, md);
  return nextV;
}

export async function setActiveVersion(slug, v) {
  await ensurePlanLoaded(slug, v);
  await updateProject(slug, { activeVersion: v });
}

// ── Avancement (state.json) ───────────────────────────────────────
// state.projects[slug] = {
//   items:        { [itemId]: { status: 'done'|'skipped', doneAt, skippedAt, note, version } },
//   deliverables: { [id]: { done, doneAt } },
//   moves:        { [itemId]: weekNum }   ← item déplacé vers une autre semaine
// }

function projectState(slug) {
  const s = (_state.projects[slug] ||= {});
  s.items ||= {};
  s.deliverables ||= {};
  s.moves ||= {};
  return s;
}

export function getItemStates(slug)       { return _state.projects?.[slug]?.items || {}; }
export function getItemState(slug, id)    { return getItemStates(slug)[id] || {}; }
export function getMoves(slug)            { return _state.projects?.[slug]?.moves || {}; }
export function getDeliverableStates(slug){ return _state.projects?.[slug]?.deliverables || {}; }

// status : 'done' | 'skipped' | null (à faire)
export function setItemStatus(slug, id, status) {
  const items = projectState(slug).items;
  const prev = items[id] || {};
  const now = new Date().toISOString();
  items[id] = {
    ...prev,
    status: status || null,
    doneAt:    status === 'done'    ? now : null,
    skippedAt: status === 'skipped' ? now : null,
    // Version en vigueur au moment du cochage : deux versions peuvent réutiliser un même ID.
    version: status ? getProjectMeta(slug)?.activeVersion ?? null : prev.version ?? null,
  };
  scheduleSync();
}

export function setItemNote(slug, id, note) {
  const items = projectState(slug).items;
  items[id] = { ...(items[id] || {}), note };
  scheduleSync();
}

export function moveItem(slug, id, weekNum) {
  const moves = projectState(slug).moves;
  if (weekNum == null) delete moves[id];
  else moves[id] = weekNum;
  scheduleSync();
}

export function setDeliverableDone(slug, id, done) {
  projectState(slug).deliverables[id] = { done, doneAt: done ? new Date().toISOString() : null };
  scheduleSync();
}

function scheduleSync() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => { _syncTimer = null; syncState(); }, 600);
}

async function syncState() {
  if (_syncing) { scheduleSync(); return; }
  _syncing = true;
  try {
    // Toujours relire le SHA pour éviter les 409
    const current = await getFile(STATE_PATH);
    _state.lastUpdated = new Date().toISOString();
    await putFile(STATE_PATH, JSON.stringify(_state, null, 2), current?.sha || null,
      { commitMessage: 'roadmap: update state.json [skip ci]' });
  } catch (err) {
    console.error('Sync state failed', err);
    showToast('Erreur de synchronisation', 'error');
  } finally {
    _syncing = false;
  }
}

// ── Profil ────────────────────────────────────────────────────────

export function getProfile() { return _profile; }

export async function saveProfile(profile) {
  const file = await getFile(PROFILE_PATH);
  _profileSha = await putFile(PROFILE_PATH, JSON.stringify(profile, null, 2), file?.sha || _profileSha);
  _profile = profile;
}

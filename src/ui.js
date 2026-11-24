// Окно библиотеки: список карточек, редактор записи, импорт/экспорт.
import { t } from './i18n.js';
import {
    MAX_DEPTH, POS, ROLE, chatToggleState, ctx, currentChatId, entries, exportData, isActive,
    isOnForChat, newEntry, parseImport, save, setChatToggle,
} from './state.js';

const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

let host = null;
let openId = null;     // какая карточка раскрыта
let query = '';         // как набрано в поле (без trim — иначе нельзя набрать пробел)
let lastFocus = null;   // куда вернуть фокус после закрытия

const $q = sel => host.querySelector(sel);

export function buildPanel() {
    if (document.getElementById('plib_host')) { host = document.getElementById('plib_host'); return; }
    host = document.createElement('div');
    host.id = 'plib_host';
    host.className = 'plib-host';
    host.hidden = true;
    host.innerHTML = `
      <div class="plib-backdrop" data-act="close"></div>
      <section class="plib-panel" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="plib_title">
        <header class="plib-head">
          <div class="plib-brand">
            <span class="plib-logo"><i class="fa-solid fa-book-bookmark"></i></span>
            <div class="plib-brand-text">
              <h3 id="plib_title">${esc(t('title'))}</h3>
              <div class="plib-sub" id="plib_sub"></div>
            </div>
          </div>
          <div class="plib-head-actions">
            <button type="button" class="plib-icon-btn" data-act="import" title="${esc(t('importBtn'))}" aria-label="${esc(t('importBtn'))}"><i class="fa-solid fa-file-import"></i></button>
            <button type="button" class="plib-icon-btn" data-act="export" title="${esc(t('exportBtn'))}" aria-label="${esc(t('exportBtn'))}"><i class="fa-solid fa-file-export"></i></button>
            <button type="button" class="plib-icon-btn" data-act="close" title="${esc(t('close'))}" aria-label="${esc(t('close'))}"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </header>
        <div class="plib-toolbar">
          <label class="plib-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" id="plib_search" placeholder="${esc(t('search'))}" autocomplete="off">
          </label>
          <button type="button" class="plib-add" data-act="add"><i class="fa-solid fa-plus"></i><span>${esc(t('add'))}</span></button>
        </div>
        <div class="plib-list" id="plib_list"></div>
        <footer class="plib-foot">${esc(t('footer'))}</footer>
        <input type="file" id="plib_file" accept=".json,application/json,application/octet-stream,text/plain" hidden>
      </section>`;
    document.body.append(host);

    host.addEventListener('click', onClick);
    host.addEventListener('input', onInput);
    host.addEventListener('change', onChange);
    // Перехват клавиш в фазе захвата: пока окно открыто, горячие клавиши таверны
    // (стрелки — свайпы, Alt+Enter — «Продолжить», Escape — стоп генерации) не должны срабатывать.
    window.addEventListener('keydown', onKeyCapture, true);
    $q('#plib_file').addEventListener('change', onImportFile);
}

/** Непрозрачная версия цвета фона темы — подложка окна (см. style.css). */
function applyBaseColor() {
    const raw = getComputedStyle(document.body).getPropertyValue('--SmartThemeBlurTintColor').trim();
    const m = raw.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (m) host.style.setProperty('--plib-base', `rgb(${m[1]}, ${m[2]}, ${m[3]})`);
    else host.style.removeProperty('--plib-base');
}

function onKeyCapture(e) {
    if (!isOpen()) return;
    if (document.querySelector('dialog[open]')) return;   // поверх открыт попап таверны — клавиши его
    if (e.key === 'Escape') {
        if (e.isComposing) return;                         // Escape отменяет набор IME, а не закрывает окно
        e.preventDefault();
        e.stopPropagation();
        closePanel();
        return;
    }
    e.stopPropagation();   // поведение по умолчанию (ввод текста, Tab) сохраняется
}

export function openPanel() {
    if (!host) buildPanel();
    if (!isOpen()) lastFocus = document.activeElement;
    applyBaseColor();
    host.hidden = false;
    document.documentElement.classList.add('plib-open');
    render();
    setTimeout(() => $q('.plib-panel')?.focus?.(), 0);
}

export function closePanel() {
    if (!host) return;
    host.hidden = true;
    document.documentElement.classList.remove('plib-open');
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch { /* ignore */ } }
    lastFocus = null;
}

export const isOpen = () => !!host && !host.hidden;

/** Перерисовать, если окно открыто (смена чата и т.п.). */
export function refresh() { if (isOpen()) render(); }

// ---------- отрисовка ----------

function badges(e, chatId) {
    const b = [];
    if (e.position === POS.IN_CHAT) b.push(`<span class="plib-badge">${esc(t('badgeInChat', e.depth))} · ${esc(roleName(e.role))}</span>`);
    else if (e.position === POS.IN_PROMPT) b.push(`<span class="plib-badge">${esc(t('badgeInPrompt'))}</span>`);
    else b.push(`<span class="plib-badge">${esc(t('badgeBefore'))}</span>`);
    if (!e.text.trim()) b.push(`<span class="plib-badge plib-badge-warn">${esc(t('badgeEmpty'))}</span>`);
    if (chatId && e.scope === 'all' && e.excludeChats.includes(chatId)) b.push(`<span class="plib-badge plib-badge-warn">${esc(t('badgeOffHere'))}</span>`);
    if (e.scope === 'only' && chatId) {
        b.push(e.onlyChats.includes(chatId)
            ? `<span class="plib-badge plib-badge-accent">${esc(t('badgeOnlyHere'))}</span>`
            : `<span class="plib-badge plib-badge-warn">${esc(t('badgeOnlyOther'))}</span>`);
    }
    return b.join('');
}

function roleName(r) {
    return r === ROLE.USER ? t('roleUser') : r === ROLE.ASSISTANT ? t('roleAssistant') : t('roleSystem');
}

function matches(e) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return e.name.toLowerCase().includes(q) || e.text.toLowerCase().includes(q);
}

function cardHead(e, chatId) {
    return `
      <span class="plib-grip" title="${esc(t('dragTitle'))}"><i class="fa-solid fa-grip-vertical"></i></span>
      <label class="plib-switch" title="${esc(t('toggleTitle'))}">
        <input type="checkbox" data-f="enabled" ${e.enabled ? 'checked' : ''} aria-label="${esc(`${t('toggleTitle')}: ${e.name.trim() || t('untitled')}`)}">
        <span class="plib-slider"></span>
      </label>
      <button type="button" class="plib-title-btn" data-act="toggle-open" aria-expanded="${openId === e.id}">
        <span class="plib-name">${esc(e.name.trim() || t('untitled'))}</span>
        <span class="plib-badges">${badges(e, chatId)}</span>
      </button>
      <button type="button" class="plib-icon-btn plib-chev" data-act="toggle-open" title="${esc(t('editTitle'))}" aria-label="${esc(t('editTitle'))}" aria-expanded="${openId === e.id}"><i class="fa-solid fa-chevron-down"></i></button>`;
}

function editor(e, chatId) {
    const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
    const inChat = e.position === POS.IN_CHAT;
    const counter = e.scope === 'only'
        ? (e.onlyChats.length ? t('includedIn', e.onlyChats.length) : '')
        : (e.excludeChats.length ? t('excludedIn', e.excludeChats.length) : '');
    return `
      <div class="plib-editor">
        <label class="plib-field">
          <span>${esc(t('name'))}</span>
          <input type="text" class="text_pole" data-f="name" value="${esc(e.name)}" maxlength="200">
        </label>
        <label class="plib-field">
          <span>${esc(t('prompt'))}</span>
          <textarea class="text_pole plib-text" data-f="text" rows="6" placeholder="${esc(t('promptPh'))}">${esc(e.text)}</textarea>
        </label>
        <div class="plib-grid">
          <label class="plib-field">
            <span>${esc(t('position'))}</span>
            <select class="text_pole" data-f="position">
              ${opt(POS.IN_CHAT, e.position, t('posInChat'))}
              ${opt(POS.IN_PROMPT, e.position, t('posInPrompt'))}
              ${opt(POS.BEFORE_PROMPT, e.position, t('posBefore'))}
            </select>
          </label>
          <label class="plib-field ${inChat ? '' : 'plib-dim'}">
            <span>${esc(t('depth'))}</span>
            <input type="number" class="text_pole" data-f="depth" min="0" max="${MAX_DEPTH}" step="1" value="${e.depth}" ${inChat ? '' : 'disabled'} title="${esc(t('depthHint'))}">
          </label>
          <label class="plib-field ${inChat ? '' : 'plib-dim'}">
            <span>${esc(t('role'))}</span>
            <select class="text_pole" data-f="role" ${inChat ? '' : 'disabled'}>
              ${opt(ROLE.SYSTEM, e.role, t('roleSystem'))}
              ${opt(ROLE.USER, e.role, t('roleUser'))}
              ${opt(ROLE.ASSISTANT, e.role, t('roleAssistant'))}
            </select>
          </label>
        </div>
        <div class="plib-chats">
          <div class="plib-seg" role="radiogroup" aria-label="${esc(t('scope'))}">
            <button type="button" role="radio" aria-checked="${e.scope === 'all'}" data-act="scope" data-v="all" class="${e.scope === 'all' ? 'on' : ''}">${esc(t('scopeAll'))}</button>
            <button type="button" role="radio" aria-checked="${e.scope === 'only'}" data-act="scope" data-v="only" class="${e.scope === 'only' ? 'on' : ''}">${esc(t('scopeOnly'))}</button>
          </div>
          <label class="plib-switch-row ${chatId ? '' : 'plib-dim'}">
            <span class="plib-switch">
              <input type="checkbox" data-f="thisChat" ${chatToggleState(e, chatId) ? 'checked' : ''} ${chatId ? '' : 'disabled'}>
              <span class="plib-slider"></span>
            </span>
            <span>${esc(chatId ? t('thisChat') : t('thisChatNone'))}</span>
          </label>
          ${counter ? `<div class="plib-counter">${esc(counter)} · <button type="button" class="plib-link" data-act="reset-chats">${esc(t('resetChats'))}</button></div>` : ''}
        </div>
        <div class="plib-editor-actions">
          <button type="button" class="plib-btn" data-act="duplicate"><i class="fa-solid fa-clone"></i>${esc(t('duplicate'))}</button>
          <button type="button" class="plib-btn plib-danger" data-act="delete"><i class="fa-solid fa-trash-can"></i>${esc(t('remove'))}</button>
        </div>
      </div>`;
}

/** Имя персонажа или группы текущего чата — для подзаголовка. */
function chatLabel() {
    const c = ctx();
    try {
        if (c.groupId) return c.groups?.find(g => String(g.id) === String(c.groupId))?.name || '';
        if (c.characterId !== undefined && c.characterId !== null) return c.characters?.[c.characterId]?.name || '';
    } catch { /* ignore */ }
    return '';
}

function renderSubtitle() {
    const list = entries();
    const chatId = currentChatId();
    const active = list.filter(e => isActive(e, chatId)).length;
    const sub = $q('#plib_sub');
    sub.textContent = `${t('subtitle', active, list.length)} · ${chatId ? `${t('chat')}: ${chatLabel() || chatId}` : t('noChat')}`;
    sub.title = chatId;
}

/** Описание элемента с фокусом, чтобы найти его же после перерисовки. */
function focusKey() {
    const el = document.activeElement;
    if (!el || !host.contains(el)) return null;
    return { id: idOf(el), act: el.dataset?.act, f: el.dataset?.f, v: el.dataset?.v };
}

function restoreFocus(key) {
    if (host.contains(document.activeElement)) return;
    let el = null;
    if (key) {
        const scope = key.id ? cardEl(key.id) : host;
        const sel = key.f ? `[data-f="${key.f}"]` : key.act ? `[data-act="${key.act}"]${key.v ? `[data-v="${key.v}"]` : ''}` : null;
        if (scope && sel) el = scope.querySelector(sel);
    }
    (el || $q('.plib-panel'))?.focus({ preventScroll: true });
}

function render() {
    const fk = focusKey();
    const list = entries();
    const chatId = currentChatId();
    renderSubtitle();

    const box = $q('#plib_list');
    const shown = list.filter(matches);
    if (!list.length) box.innerHTML = `<div class="plib-empty"><i class="fa-regular fa-folder-open"></i>${esc(t('empty'))}</div>`;
    else if (!shown.length) box.innerHTML = `<div class="plib-empty"><i class="fa-solid fa-magnifying-glass"></i>${esc(t('notFound'))}</div>`;
    else {
        box.innerHTML = shown.map(e => `
          <article class="plib-card ${isActive(e, chatId) ? 'is-active' : ''} ${isOnForChat(e, chatId) ? '' : 'is-off'} ${openId === e.id ? 'is-open' : ''}" data-id="${esc(e.id)}">
            <div class="plib-row">${cardHead(e, chatId)}</div>
            ${openId === e.id ? editor(e, chatId) : ''}
          </article>`).join('');
    }
    initSortable(box);
    if (isOpen()) restoreFocus(fk);
}

/** Обновить только шапку карточки и подзаголовок — чтобы не терять фокус при наборе текста. */
function softUpdate(id) {
    const e = byId(id);
    const card = cardEl(id);
    if (!e || !card) return render();
    const chatId = currentChatId();
    card.classList.toggle('is-active', isActive(e, chatId));
    card.classList.toggle('is-off', !isOnForChat(e, chatId));
    const name = card.querySelector('.plib-name');
    if (name) name.textContent = e.name.trim() || t('untitled');
    const b = card.querySelector('.plib-badges');
    if (b) b.innerHTML = badges(e, chatId);
    card.querySelector('[data-f="enabled"]')?.setAttribute('aria-label', `${t('toggleTitle')}: ${e.name.trim() || t('untitled')}`);
    renderSubtitle();
}

function initSortable(box) {
    const $ = window.jQuery;
    if (!$?.fn?.sortable) return;
    const $box = $(box);
    if ($box.data('ui-sortable')) $box.sortable('destroy');
    if (query.trim()) return;   // при поиске порядок не меняем: видна только часть списка
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    $box.sortable({
        items: '> .plib-card',
        handle: '.plib-grip',
        axis: 'y',
        delay: coarse ? 300 : 30,
        tolerance: 'pointer',
        placeholder: 'plib-card-placeholder',
        start: (_, ui) => ui.placeholder.height(ui.item.outerHeight()),
        update: () => {
            const order = [...box.querySelectorAll('.plib-card')].map(el => el.dataset.id);
            const list = entries();
            list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
            save();
            setTimeout(render, 0);   // не уничтожаем sortable внутри его же обработчика
        },
    });
}

// ---------- события ----------

const byId = id => entries().find(e => e.id === id);
const cardEl = id => host.querySelector(`.plib-card[data-id="${CSS.escape(id)}"]`);
const idOf = el => el.closest('.plib-card')?.dataset.id;

async function onClick(ev) {
    const btn = ev.target.closest('[data-act]');
    if (!btn || !host.contains(btn)) return;
    const act = btn.dataset.act;
    const id = idOf(btn);
    const e = id ? byId(id) : null;

    switch (act) {
        case 'close': closePanel(); break;
        case 'add': {
            const ne = newEntry(t('newName'));
            entries().unshift(ne);
            openId = ne.id;
            query = '';
            $q('#plib_search').value = '';
            save();
            render();
            cardEl(ne.id)?.querySelector('[data-f="name"]')?.select();
            break;
        }
        case 'toggle-open':
            openId = openId === id ? null : id;
            render();
            if (openId) cardEl(openId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            break;
        case 'scope':
            if (!e) break;
            e.scope = btn.dataset.v === 'only' ? 'only' : 'all';
            save();
            render();
            break;
        case 'reset-chats':
            if (!e) break;
            if (e.scope === 'only') e.onlyChats = []; else e.excludeChats = [];
            save();
            render();
            break;
        case 'duplicate': {
            if (!e) break;
            const list = entries();
            const copy = newEntry('', {
                ...structuredClone(e), id: undefined, enabled: false,
                name: `${e.name.trim() || t('untitled')} (${t('copySuffix')})`,
            });
            list.splice(list.indexOf(e) + 1, 0, copy);
            openId = copy.id;
            save();
            render();
            break;
        }
        case 'delete': {
            if (!e) break;
            const ok = await confirmDelete(e.name.trim() || t('untitled'));
            if (!ok) break;
            const list = entries();
            const i = list.indexOf(e);
            if (i >= 0) list.splice(i, 1);
            if (openId === id) openId = null;
            save();
            render();
            break;
        }
        case 'export': doExport(); break;
        case 'import': $q('#plib_file').click(); break;
    }
}

async function confirmDelete(name) {
    const c = ctx();
    try {
        if (c.callGenericPopup && c.POPUP_TYPE) {
            const r = await c.callGenericPopup(esc(t('confirmDelete', name)), c.POPUP_TYPE.CONFIRM);
            return !!r && r === (c.POPUP_RESULT?.AFFIRMATIVE ?? 1);
        }
    } catch { /* запасной вариант ниже */ }
    return window.confirm(t('confirmDelete', name));
}

function onInput(ev) {
    const el = ev.target;
    if (el.id === 'plib_search') {
        query = el.value;
        render();
        return;
    }
    const f = el.dataset?.f;
    const id = idOf(el);
    const e = id ? byId(id) : null;
    if (!e || !f) return;
    if (f === 'name') e.name = el.value;
    else if (f === 'text') e.text = el.value;
    else if (f === 'depth') {
        const n = Math.trunc(Number(el.value));
        if (el.value === '' || !Number.isFinite(n)) return;   // пустое поле — ждём ввода, не портим значение
        e.depth = Math.min(MAX_DEPTH, Math.max(0, n));
    } else return;
    save();
    softUpdate(id);
}

function onChange(ev) {
    const el = ev.target;
    const f = el.dataset?.f;
    const id = idOf(el);
    const e = id ? byId(id) : null;
    if (!e || !f) return;
    switch (f) {
        case 'enabled': e.enabled = el.checked; break;
        case 'position': e.position = Number(el.value); break;
        case 'role': e.role = Number(el.value); break;
        case 'thisChat': setChatToggle(e, currentChatId(), el.checked); break;
        case 'depth': el.value = String(e.depth); return;   // после ухода с поля показать сохранённое значение
        default: return;
    }
    save();
    if (f === 'enabled') softUpdate(id); else render();
}

function doExport() {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prompt-library-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    window.toastr?.success(t('exported', data.entries.length));
}

async function onImportFile(ev) {
    const input = ev.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let added = [];
    try { added = parseImport(JSON.parse(await file.text())); } catch { added = []; }
    if (!added.length) { window.toastr?.error(t('importFail')); return; }
    entries().push(...added);
    save();
    render();
    window.toastr?.success(t('imported', added.length));
}

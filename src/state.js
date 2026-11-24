// Хранилище библиотеки и вставка промтов в запрос.
// Записи лежат в extensionSettings.promptLibrary и не зависят от чата, персонажа и пресета.

export const MODULE = 'promptLibrary';
export const KEY_PREFIX = 'plib_';

// Совпадают с extension_prompt_types / extension_prompt_roles таверны.
export const POS = { IN_PROMPT: 0, IN_CHAT: 1, BEFORE_PROMPT: 2 };
export const ROLE = { SYSTEM: 0, USER: 1, ASSISTANT: 2 };
export const MAX_DEPTH = 10000;

export const ctx = () => SillyTavern.getContext();

export function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Имя единственной пустой записи, которая создаётся при первом запуске. */
export const TEMPLATE_NAME = 'Your Prompt';

/**
 * Настройки инжекта по умолчанию — как у Авторской заметки: берём её значения по умолчанию
 * из настроек таверны (если пользователь их менял), иначе стандарт: в чате, глубина 4, system.
 */
export function authorsNoteDefaults() {
    let note = {};
    try { note = ctx().extensionSettings?.note ?? {}; } catch { /* нет контекста */ }
    const pos = num(note.defaultPosition);
    const role = num(note.defaultRole);
    return {
        position: Object.values(POS).includes(pos) ? pos : POS.IN_CHAT,
        depth: clampInt(note.defaultDepth, 0, MAX_DEPTH, 4),
        role: Object.values(ROLE).includes(role) ? role : ROLE.SYSTEM,
    };
}

/** Новая запись. По умолчанию выключена, пустая, инжект — как у Авторской заметки. */
export function newEntry(name, extra = {}) {
    return normalizeEntry({ ...authorsNoteDefaults(), id: uid(), name, ...extra });
}

// null, '' и прочие пустые значения → значение по умолчанию (Number(null) === 0 — ловушка)
const num = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) ? Number(v) : NaN;

const clampInt = (v, lo, hi, def) => {
    const n = Math.trunc(num(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

/** Приводит запись к корректному виду (для старых настроек и импорта). */
export function normalizeEntry(e) {
    const src = e && typeof e === 'object' ? e : {};
    const pos = num(src.position);
    const role = num(src.role);
    const ids = a => Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && x))] : [];
    return {
        id: typeof src.id === 'string' && src.id ? src.id : uid(),
        name: typeof src.name === 'string' ? src.name : '',
        text: typeof src.text === 'string' ? src.text : '',
        enabled: src.enabled === true,
        position: Object.values(POS).includes(pos) ? pos : POS.IN_CHAT,
        depth: clampInt(src.depth, 0, MAX_DEPTH, 4),
        role: Object.values(ROLE).includes(role) ? role : ROLE.SYSTEM,
        scope: src.scope === 'only' ? 'only' : 'all',
        excludeChats: ids(src.excludeChats),
        onlyChats: ids(src.onlyChats),
    };
}

/** Настройки расширения. При первом запуске — одна пустая выключенная запись. */
export function store(defaultName = TEMPLATE_NAME) {
    const { extensionSettings } = ctx();
    const s = extensionSettings[MODULE] ??= {};
    if (!Array.isArray(s.entries)) s.entries = [];
    if (!s.initialized) {
        if (!s.entries.length) s.entries.push(newEntry(defaultName));
        s.initialized = true;
    }
    s.entries = s.entries.map(normalizeEntry);
    // id должны быть уникальны: от них зависят ключи инжекта
    const seen = new Set();
    for (const e of s.entries) {
        if (seen.has(e.id)) e.id = uid();
        seen.add(e.id);
    }
    return s;
}

export function entries() {
    return ctx().extensionSettings[MODULE]?.entries ?? [];
}

/** Имя файла открытого чата (без .jsonl) или '' — нужно только для веток и переноса старых привязок. */
export function currentChatFile() {
    try {
        const id = ctx().getCurrentChatId?.();
        return id ? String(id) : '';
    } catch { return ''; }
}

/**
 * Ключ открытого чата для привязок — постоянный UUID таверны `chat_metadata.integrity`.
 * Он уникален даже у одноимённых чатов разных персонажей, не меняется при переименовании,
 * а новая ветка или чекпоинт получает свой. Таверна ставит его при загрузке чата; если его
 * почему-то нет, создаём сами (сохранится вместе с чатом, см. persistChatKey).
 */
export function currentChatId() {
    try {
        const c = ctx();
        if (!c.getCurrentChatId?.()) return '';
        const meta = c.chatMetadata;
        if (!meta || typeof meta !== 'object') return '';
        if (!meta.integrity) meta.integrity = globalThis.crypto?.randomUUID?.() ?? `plib-${uid()}`;
        return String(meta.integrity);
    } catch { return ''; }
}

/** Сохранить метаданные чата, чтобы ключ (integrity) точно лёг в файл чата. */
export function persistChatKey() {
    try { ctx().saveMetadataDebounced?.(); } catch { /* ignore */ }
}

/** Владелец открытого чата: персонаж (по файлу аватара) или группа. */
export function currentChatOwner() {
    try {
        const c = ctx();
        if (c.groupId) return `g:${c.groupId}`;
        const ch = c.characters?.[c.characterId];
        return ch ? `c:${ch.avatar ?? c.characterId}` : '';
    } catch { return ''; }
}

/**
 * Перенос старых привязок (до 0.1.0 они хранились по имени файла чата) на ключ чата.
 * Имя файла неоднозначно (одноимённые чаты разных персонажей), поэтому привязку забирает
 * первый открытый чат с таким именем, а имя из списка удаляется.
 */
export function migrateLegacyChat(file, key) {
    if (!file || !key || file === key) return false;
    let changed = false;
    const swap = list => {
        const i = list.indexOf(file);
        if (i < 0) return;
        if (list.includes(key)) list.splice(i, 1); else list[i] = key;
        changed = true;
    };
    for (const e of entries()) { swap(e.excludeChats); swap(e.onlyChats); }
    // отметка «ветка уже унаследовала» тоже по старому имени — переносим, иначе ветка унаследует повторно
    const done = ctx().extensionSettings[MODULE]?.branchesDone;
    if (Array.isArray(done)) swap(done);
    return changed;
}

/**
 * Справочник «владелец + имя файла чата → ключ чата». Нужен, чтобы найти родителя ветки
 * или чекпоинта по main_chat, даже если ветку открыли не сразу из родителя. Старые записи
 * (после переименования) не удаляем: main_chat у веток хранит имя родителя на момент создания.
 */
export function rememberChat(owner, file, key) {
    const s = ctx().extensionSettings[MODULE];
    if (!s || !owner || !file || !key) return false;
    if (!s.chatIndex || typeof s.chatIndex !== 'object' || Array.isArray(s.chatIndex)) s.chatIndex = {};
    const k = `${owner}|${file}`;
    if (s.chatIndex[k] === key) return false;
    s.chatIndex[k] = key;
    return true;
}

export function findChatKey(owner, file) {
    const idx = ctx().extensionSettings[MODULE]?.chatIndex;
    return (idx && owner && file && idx[`${owner}|${file}`]) || '';
}

/** Есть ли у ключа (или старого имени) хоть одна привязка в библиотеке. */
export function hasBindings(id) {
    return !!id && entries().some(e => e.excludeChats.includes(id) || e.onlyChats.includes(id));
}

/** Пользователь сам настроил этот чат — наследование от родителя для него больше не применяется. */
export function freezeChat(chatId) {
    const s = ctx().extensionSettings[MODULE];
    if (!s || !chatId) return;
    if (!Array.isArray(s.branchesDone)) s.branchesDone = [];
    if (!s.branchesDone.includes(chatId)) s.branchesDone.push(chatId);
}

/** Включена ли запись для указанного чата (без учёта текста). */
export function isOnForChat(e, chatId) {
    if (!e.enabled) return false;
    if (e.scope === 'only') return !!chatId && e.onlyChats.includes(chatId);
    return !chatId || !e.excludeChats.includes(chatId);
}

/** Уйдёт ли запись в запрос прямо сейчас. */
export function isActive(e, chatId = currentChatId()) {
    return isOnForChat(e, chatId) && e.text.trim().length > 0;
}

/** Переключатель «в этом чате» внутри редактора. */
export function setChatToggle(e, chatId, on) {
    if (!chatId) return;
    freezeChat(chatId);   // явный выбор пользователя наследование не перезапишет
    const list = e.scope === 'only' ? e.onlyChats : e.excludeChats;
    const want = e.scope === 'only' ? on : !on;   // в режиме «все» список — исключения
    const has = list.includes(chatId);
    if (want && !has) list.push(chatId);
    if (!want && has) list.splice(list.indexOf(chatId), 1);
}

export function chatToggleState(e, chatId) {
    if (!chatId) return false;
    return e.scope === 'only' ? e.onlyChats.includes(chatId) : !e.excludeChats.includes(chatId);
}

/** Роль имеет смысл только для вставки «в чате»; для «перед/после промта» всегда system. */
export const effectiveRole = e => e.position === POS.IN_CHAT ? e.role : ROLE.SYSTEM;

/**
 * Синхронизирует инжекты с библиотекой: убирает все свои ключи и ставит заново только
 * активные записи. Записи с одинаковыми позицией, глубиной и ролью склеиваются в один
 * инжект в порядке библиотеки — так порядок одинаков в Chat Completion и Text Completion
 * (CC вставляет «перед/после промта» в обратном порядке, если ключей несколько).
 */
export function syncInjections() {
    const c = ctx();
    const prompts = c.extensionPrompts;
    if (prompts) {
        for (const k of Object.keys(prompts)) if (k.startsWith(KEY_PREFIX)) delete prompts[k];
    }
    const chatId = currentChatId();
    const groups = new Map();
    for (const e of entries()) {
        if (!isActive(e, chatId)) continue;
        const role = effectiveRole(e);
        const depth = e.position === POS.IN_CHAT ? e.depth : 0;
        const key = `${KEY_PREFIX}${e.position}_${depth}_${role}`;
        if (!groups.has(key)) groups.set(key, { position: e.position, depth, role, texts: [] });
        groups.get(key).texts.push(e.text.trim());
    }
    for (const [key, g] of groups) {
        c.setExtensionPrompt(key, g.texts.join('\n\n'), g.position, g.depth, false, g.role);
    }
}

/** Имя файла чата без .jsonl. */
export const stripJsonl = v => String(v ?? '').replace(/\.jsonl$/i, '');

/**
 * Ветка (или чекпоинт) чата наследует настройки родителя: если промт выключен в родительском
 * чате или включён там в режиме «только выбранные», так же будет и в ветке.
 */
export function inheritChatSettings(parentKey, childKey) {
    if (!parentKey || !childKey || parentKey === childKey) return false;
    let changed = false;
    for (const e of entries()) {
        for (const list of [e.excludeChats, e.onlyChats]) {
            if (list.includes(parentKey) && !list.includes(childKey)) { list.push(childKey); changed = true; }
        }
    }
    return changed;
}

/**
 * Один раз на ветку: отметить её как обработанную и, если известен родитель, унаследовать
 * его привязки. Отметки хранятся по ключу чата (он не меняется при переименовании) и никогда
 * не удаляются — иначе старая ветка могла бы унаследовать повторно и затереть свои настройки.
 * Возвращает true, если ветка встречена впервые (настройки изменились — нужно сохранить).
 */
export function inheritOnce(parentKey, childKey) {
    const s = ctx().extensionSettings[MODULE];
    if (!s || !childKey || !parentKey) return false;   // родитель неизвестен — не отмечаем, попробуем позже
    if (!Array.isArray(s.branchesDone)) s.branchesDone = [];
    if (s.branchesDone.includes(childKey)) return false;
    s.branchesDone.push(childKey);
    inheritChatSettings(parentKey, childKey);
    return true;
}

export function save() {
    ctx().saveSettingsDebounced();
    syncInjections();
}

/** Данные для экспорта: без привязок к чатам (они не переносятся между тавернами). */
export function exportData() {
    return {
        format: 'st-prompt-library',
        version: 1,
        entries: entries().map(e => ({
            name: e.name, text: e.text, enabled: e.enabled,
            position: e.position, depth: e.depth, role: e.role,
        })),
    };
}

/** Разбор импортируемого JSON: массив записей или { entries: [...] }. */
export function parseImport(json) {
    const list = Array.isArray(json) ? json : Array.isArray(json?.entries) ? json.entries : null;
    if (!list) return [];
    return list
        .filter(x => x && typeof x === 'object' && typeof x.text === 'string')
        .map(x => normalizeEntry({ ...x, id: uid(), scope: 'all', excludeChats: [], onlyChats: [] }));
}

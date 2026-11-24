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

/** Новая запись. По умолчанию выключена и пустая. */
export function newEntry(name, extra = {}) {
    return normalizeEntry({ id: uid(), name, ...extra });
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
export function store(defaultName = 'New prompt') {
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

export function currentChatId() {
    try {
        const id = ctx().getCurrentChatId?.();
        return id ? String(id) : '';
    } catch { return ''; }
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

/** Чат переименован: переносим привязки со старого имени файла на новое. */
export function renameChatId(oldId, newId) {
    const strip = v => String(v ?? '').replace(/\.jsonl$/i, '');
    const from = strip(oldId);
    const to = strip(newId);
    if (!from || !to || from === to) return false;
    let changed = false;
    for (const e of entries()) {
        for (const list of [e.excludeChats, e.onlyChats]) {
            const i = list.indexOf(from);
            if (i < 0) continue;
            if (list.includes(to)) list.splice(i, 1); else list[i] = to;
            changed = true;
        }
    }
    return changed;
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

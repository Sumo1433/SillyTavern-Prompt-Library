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

const clampInt = (v, lo, hi, def) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

/** Приводит запись к корректному виду (для старых настроек и импорта). */
export function normalizeEntry(e) {
    const src = e && typeof e === 'object' ? e : {};
    const pos = Number(src.position);
    const role = Number(src.role);
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

/**
 * Синхронизирует инжекты с библиотекой: убирает все свои ключи и ставит заново
 * только активные записи. Порядок ключей = порядок в библиотеке (таверна сортирует ключи).
 */
export function syncInjections() {
    const c = ctx();
    const prompts = c.extensionPrompts;
    if (prompts) {
        for (const k of Object.keys(prompts)) if (k.startsWith(KEY_PREFIX)) delete prompts[k];
    }
    const chatId = currentChatId();
    entries().forEach((e, i) => {
        if (!isActive(e, chatId)) return;
        const key = `${KEY_PREFIX}${String(i).padStart(4, '0')}_${e.id}`;
        c.setExtensionPrompt(key, e.text, e.position, e.depth, false, e.role);
    });
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
        .filter(x => x && typeof x === 'object' && (typeof x.text === 'string' || typeof x.name === 'string'))
        .map(x => normalizeEntry({ ...x, id: uid(), scope: 'all', excludeChats: [], onlyChats: [] }));
}

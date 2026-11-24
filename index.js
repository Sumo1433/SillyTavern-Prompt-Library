// Prompt Library — библиотека своих промтов для SillyTavern.
// Каждая запись: имя, текст, тип инжекта, глубина, роль, тумблер. Работает поверх штатного
// механизма extension prompts (как Author's Note), поэтому не зависит от пресета, API и модели.
import { t } from './src/i18n.js';
import { currentChatFile, currentChatId, currentChatOwner, ctx, inheritOnce, migrateLegacyChat, persistChatKey, store, stripJsonl, syncInjections } from './src/state.js';
import { buildPanel, openPanel, refresh } from './src/ui.js';

function addMenuItem() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('plib_menu')) return;
    const it = document.createElement('div');
    it.id = 'plib_menu';
    it.tabIndex = 0;
    it.className = 'list-group-item flex-container flexGap5 interactable';
    it.innerHTML = '<div class="fa-solid fa-book-bookmark extensionsMenuExtensionButton"></div><span></span>';
    it.querySelector('span').textContent = t('menu');
    // Клик не останавливаем: штатный обработчик таверны сам закроет меню палочки.
    // Enter обрабатывает таверна (.interactable превращает его в click).
    it.addEventListener('click', () => openPanel());
    it.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); it.click(); } });
    menu.append(it);
}

/** Чат, открытый перед текущим: по нему узнаём родителя только что созданной ветки. */
let prevChat = { key: '', file: '', owner: '' };

/**
 * При смене чата: перенос старых привязок по имени файла и наследование для новой ветки.
 * Ветка/чекпоинт: таверна пишет в метаданные main_chat — имя родительского чата. Ветка
 * открывается сразу из родителя, поэтому родитель — это предыдущий чат того же персонажа
 * с этим именем. Наследование — один раз на ветку (inheritOnce).
 */
function onChatChanged() {
    const c = ctx();
    const key = currentChatId();
    const file = currentChatFile();
    const owner = currentChatOwner();
    let dirty = false;
    try {
        if (key && file && migrateLegacyChat(file, key)) dirty = true;
        const parentFile = stripJsonl(c.chatMetadata?.main_chat);
        if (key && parentFile && parentFile !== file) {
            const parentKey = prevChat.key && prevChat.file === parentFile && prevChat.owner === owner ? prevChat.key : '';
            if (inheritOnce(parentKey, key)) dirty = true;
        }
    } catch (e) {
        console.warn('[Prompt Library] chat bookkeeping skipped', e);
    }
    if (dirty) { c.saveSettingsDebounced(); persistChatKey(); }
    prevChat = { key, file, owner };
}

function init() {
    store();
    buildPanel();
    addMenuItem();
    syncInjections();

    const { eventSource, eventTypes } = ctx();
    const resync = () => { syncInjections(); refresh(); };
    prevChat = { key: currentChatId(), file: currentChatFile(), owner: currentChatOwner() };
    eventSource.on(eventTypes.CHAT_CHANGED, () => { onChatChanged(); resync(); });
    eventSource.on(eventTypes.APP_READY, () => { addMenuItem(); syncInjections(); });
    // Переименование не трогаем: ключ чата (integrity) при нём не меняется.
    // Подстраховка перед каждой генерацией: состояние инжектов всегда совпадает с библиотекой.
    if (eventTypes.GENERATION_AFTER_COMMANDS) eventSource.on(eventTypes.GENERATION_AFTER_COMMANDS, syncInjections);
}

jQuery(() => {
    try { init(); } catch (e) {
        console.error('[Prompt Library] init failed', e);
        window.toastr?.error(String(e?.message || e), 'Prompt Library');
    }
});

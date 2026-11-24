// Prompt Library — библиотека своих промтов для SillyTavern.
// Каждая запись: имя, текст, тип инжекта, глубина, роль, тумблер. Работает поверх штатного
// механизма extension prompts (как Author's Note), поэтому не зависит от пресета, API и модели.
import { t } from './src/i18n.js';
import { currentChatId, ctx, renameChatId, sanitizeChatFile, store, stripJsonl, syncInjections } from './src/state.js';
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

function init() {
    store();
    buildPanel();
    addMenuItem();
    syncInjections();

    const { eventSource, eventTypes } = ctx();
    const resync = () => { syncInjections(); refresh(); };
    let lastChatId = currentChatId();
    eventSource.on(eventTypes.CHAT_CHANGED, () => { lastChatId = currentChatId(); resync(); });
    eventSource.on(eventTypes.APP_READY, () => { addMenuItem(); syncInjections(); });
    // Переименование чата меняет его id — переносим исключения и «только в выбранных».
    if (eventTypes.CHAT_RENAMED) {
        eventSource.on(eventTypes.CHAT_RENAMED, data => {
            const from = stripJsonl(data?.oldFileName);
            // Таверна кладёт в событие имя до очистки сервером. Если переименован открытый чат,
            // он уже перезагружен — берём настоящий id; иначе повторяем серверную очистку.
            const to = from && from === lastChatId && currentChatId() ? currentChatId() : stripJsonl(sanitizeChatFile(data?.newFileName));
            if (renameChatId(from, to)) ctx().saveSettingsDebounced();
            lastChatId = currentChatId();
            resync();
        });
    }
    // Подстраховка перед каждой генерацией: состояние инжектов всегда совпадает с библиотекой.
    if (eventTypes.GENERATION_AFTER_COMMANDS) eventSource.on(eventTypes.GENERATION_AFTER_COMMANDS, syncInjections);
}

jQuery(() => {
    try { init(); } catch (e) {
        console.error('[Prompt Library] init failed', e);
        window.toastr?.error(String(e?.message || e), 'Prompt Library');
    }
});

// Prompt Library — библиотека своих промтов для SillyTavern.
// Каждая запись: имя, текст, тип инжекта, глубина, роль, тумблер. Работает поверх штатного
// механизма extension prompts (как Author's Note), поэтому не зависит от пресета, API и модели.
import { t } from './src/i18n.js';
import { ctx, store, syncInjections } from './src/state.js';
import { buildPanel, openPanel, refresh } from './src/ui.js';

function addMenuItem() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('plib_menu')) return;
    const it = document.createElement('div');
    it.id = 'plib_menu';
    it.tabIndex = 0;
    it.className = 'list-group-item flex-container flexGap5 interactable';
    it.innerHTML = '<i class="fa-solid fa-book-bookmark"></i><span></span>';
    it.querySelector('span').textContent = t('menu');
    // Клик не останавливаем: штатный обработчик таверны сам закроет меню палочки.
    it.addEventListener('click', () => openPanel());
    it.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(); }
    });
    menu.append(it);
}

function init() {
    store(t('newName'));
    buildPanel();
    addMenuItem();
    syncInjections();

    const { eventSource, eventTypes } = ctx();
    const resync = () => { syncInjections(); refresh(); };
    eventSource.on(eventTypes.CHAT_CHANGED, resync);
    eventSource.on(eventTypes.APP_READY, () => { addMenuItem(); syncInjections(); });
    // Подстраховка перед каждой генерацией: состояние инжектов всегда совпадает с библиотекой.
    if (eventTypes.GENERATION_AFTER_COMMANDS) eventSource.on(eventTypes.GENERATION_AFTER_COMMANDS, syncInjections);
}

jQuery(() => {
    try { init(); } catch (e) {
        console.error('[Prompt Library] init failed', e);
        window.toastr?.error(String(e?.message || e), 'Prompt Library');
    }
});

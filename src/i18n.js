// Локализация Prompt Library. Язык берётся из языка интерфейса таверны.
// Поддержано: русский, украинский, китайский; остальные языки → английский.

const DICT = {
    title: { en: 'Prompt Library', ru: 'Библиотека промтов', uk: 'Бібліотека промптів', zh: '提示词库' },
    menu: { en: 'Prompt Library', ru: 'Библиотека промтов', uk: 'Бібліотека промптів', zh: '提示词库' },
    subtitle: { en: 'Active: {0} of {1}', ru: 'Активно: {0} из {1}', uk: 'Активно: {0} з {1}', zh: '已启用：{0} / {1}' },
    noChat: { en: 'no chat open', ru: 'чат не открыт', uk: 'чат не відкрито', zh: '未打开聊天' },
    chat: { en: 'chat', ru: 'чат', uk: 'чат', zh: '聊天' },
    search: { en: 'Search by name or text…', ru: 'Поиск по имени и тексту…', uk: 'Пошук за назвою і текстом…', zh: '按名称或内容搜索…' },
    add: { en: 'New prompt', ru: 'Новый промт', uk: 'Новий промпт', zh: '新建提示词' },
    newName: { en: 'New prompt', ru: 'Новый промт', uk: 'Новий промпт', zh: '新提示词' },
    untitled: { en: 'Untitled', ru: 'Без названия', uk: 'Без назви', zh: '未命名' },
    importBtn: { en: 'Import', ru: 'Импорт', uk: 'Імпорт', zh: '导入' },
    exportBtn: { en: 'Export', ru: 'Экспорт', uk: 'Експорт', zh: '导出' },
    close: { en: 'Close', ru: 'Закрыть', uk: 'Закрити', zh: '关闭' },
    empty: { en: 'The library is empty. Click “New prompt”.', ru: 'Библиотека пуста. Нажми «Новый промт».', uk: 'Бібліотека порожня. Натисни «Новий промпт».', zh: '提示词库为空。点击“新建提示词”。' },
    notFound: { en: 'Nothing found.', ru: 'Ничего не найдено.', uk: 'Нічого не знайдено.', zh: '未找到结果。' },
    toggleTitle: { en: 'On / off', ru: 'Вкл / выкл', uk: 'Увімк / вимк', zh: '开 / 关' },
    dragTitle: { en: 'Drag to reorder', ru: 'Перетащи, чтобы поменять порядок', uk: 'Перетягни, щоб змінити порядок', zh: '拖动以调整顺序' },
    editTitle: { en: 'Edit', ru: 'Редактировать', uk: 'Редагувати', zh: '编辑' },
    name: { en: 'Name', ru: 'Имя', uk: 'Назва', zh: '名称' },
    prompt: { en: 'Prompt', ru: 'Промт', uk: 'Промпт', zh: '提示词' },
    promptPh: { en: 'Prompt text. Macros like {{char}} and {{user}} work.', ru: 'Текст промта. Макросы {{char}}, {{user}} работают.', uk: 'Текст промпту. Макроси {{char}}, {{user}} працюють.', zh: '提示词内容。支持 {{char}}、{{user}} 等宏。' },
    position: { en: 'Injection', ru: 'Тип инжекта', uk: 'Тип вставки', zh: '注入位置' },
    posInChat: { en: 'In chat @ depth', ru: 'В чате на глубине', uk: 'У чаті на глибині', zh: '聊天中 @ 深度' },
    posInPrompt: { en: 'After main prompt / story string', ru: 'После основного промта', uk: 'Після основного промпту', zh: '主提示词之后' },
    posBefore: { en: 'Before main prompt / story string', ru: 'Перед основным промтом', uk: 'Перед основним промптом', zh: '主提示词之前' },
    depth: { en: 'Depth', ru: 'Глубина', uk: 'Глибина', zh: '深度' },
    depthHint: { en: '0 — after the last message', ru: '0 — после последнего сообщения', uk: '0 — після останнього повідомлення', zh: '0 — 最后一条消息之后' },
    role: { en: 'Role', ru: 'Роль', uk: 'Роль', zh: '角色' },
    roleSystem: { en: 'System', ru: 'Система', uk: 'Система', zh: '系统' },
    roleUser: { en: 'User', ru: 'Пользователь', uk: 'Користувач', zh: '用户' },
    roleAssistant: { en: 'Assistant', ru: 'Ассистент', uk: 'Асистент', zh: '助手' },
    scope: { en: 'Chats', ru: 'Чаты', uk: 'Чати', zh: '聊天范围' },
    scopeAll: { en: 'All chats', ru: 'Во всех чатах', uk: 'У всіх чатах', zh: '所有聊天' },
    scopeOnly: { en: 'Only selected chats', ru: 'Только в выбранных', uk: 'Лише у вибраних', zh: '仅限选定聊天' },
    thisChat: { en: 'Active in this chat', ru: 'Активен в этом чате', uk: 'Активний у цьому чаті', zh: '在此聊天中启用' },
    thisChatNone: { en: 'Open a chat to set this', ru: 'Открой чат, чтобы настроить', uk: 'Відкрий чат, щоб налаштувати', zh: '请先打开一个聊天' },
    excludedIn: { en: 'Turned off in {0} chat(s)', ru: 'Выключен в чатах: {0}', uk: 'Вимкнено в чатах: {0}', zh: '已在 {0} 个聊天中关闭' },
    includedIn: { en: 'Turned on in {0} chat(s)', ru: 'Включён в чатах: {0}', uk: 'Увімкнено в чатах: {0}', zh: '已在 {0} 个聊天中开启' },
    resetChats: { en: 'reset', ru: 'сбросить', uk: 'скинути', zh: '重置' },
    duplicate: { en: 'Duplicate', ru: 'Дублировать', uk: 'Дублювати', zh: '复制' },
    copySuffix: { en: 'copy', ru: 'копия', uk: 'копія', zh: '副本' },
    remove: { en: 'Delete', ru: 'Удалить', uk: 'Видалити', zh: '删除' },
    confirmDelete: { en: 'Delete prompt “{0}”?', ru: 'Удалить промт «{0}»?', uk: 'Видалити промпт «{0}»?', zh: '删除提示词“{0}”？' },
    badgeOffHere: { en: 'off in this chat', ru: 'выкл. в этом чате', uk: 'вимк. у цьому чаті', zh: '此聊天中关闭' },
    badgeOnlyHere: { en: 'on in this chat', ru: 'вкл. в этом чате', uk: 'увімк. у цьому чаті', zh: '此聊天中开启' },
    badgeOnlyOther: { en: 'not in this chat', ru: 'не в этом чате', uk: 'не в цьому чаті', zh: '不在此聊天' },
    badgeEmpty: { en: 'empty', ru: 'пусто', uk: 'порожньо', zh: '空' },
    badgeInChat: { en: 'chat @ {0}', ru: 'чат @ {0}', uk: 'чат @ {0}', zh: '聊天 @ {0}' },
    badgeInPrompt: { en: 'after prompt', ru: 'после промта', uk: 'після промпту', zh: '提示词后' },
    badgeBefore: { en: 'before prompt', ru: 'перед промтом', uk: 'перед промптом', zh: '提示词前' },
    footer: { en: 'Prompts are stored in the extension settings and do not depend on chat, character or preset. A prompt is sent only while its toggle is on and its text is not empty.', ru: 'Промты хранятся в настройках расширения и не зависят от чата, персонажа и пресета. Промт уходит в запрос, только пока тумблер включён и текст не пустой.', uk: 'Промпти зберігаються в налаштуваннях розширення і не залежать від чату, персонажа та пресету. Промпт надсилається, лише поки перемикач увімкнено і текст не порожній.', zh: '提示词保存在扩展设置中，不依赖聊天、角色或预设。只有在开关打开且内容不为空时才会发送。' },
    imported: { en: 'Imported prompts: {0}', ru: 'Импортировано промтов: {0}', uk: 'Імпортовано промптів: {0}', zh: '已导入提示词：{0}' },
    importFail: { en: 'Could not read the file: no prompts found', ru: 'Не удалось прочитать файл: промты не найдены', uk: 'Не вдалося прочитати файл: промпти не знайдено', zh: '无法读取文件：未找到提示词' },
    exported: { en: 'Exported prompts: {0}', ru: 'Экспортировано промтов: {0}', uk: 'Експортовано промптів: {0}', zh: '已导出提示词：{0}' },
};

const LOCALES = { 'ru-ru': 'ru', 'uk-ua': 'uk', 'zh-cn': 'zh', 'zh-tw': 'zh' };

let cached = null;

/** Язык интерфейса таверны → один из ключей словаря. */
export function lang() {
    if (cached) return cached;
    let loc = '';
    try { loc = String(SillyTavern.getContext().getCurrentLocale?.() || ''); } catch { /* нет контекста */ }
    if (!loc) {
        try { loc = String(localStorage.getItem('language') || navigator.language || 'en'); } catch { loc = 'en'; }
    }
    // Таверна переводит интерфейс только при точном совпадении кода с её списком языков
    // (например, «ru» без региона она показывает по-английски). Делаем так же, чтобы язык
    // расширения всегда совпадал с языком таверны.
    cached = LOCALES[loc.toLowerCase()] ?? 'en';
    return cached;
}

/** Перевод по ключу с подстановкой {0}, {1}… */
export function t(key, ...args) {
    const row = DICT[key];
    let s = row ? (row[lang()] ?? row.en) : key;
    args.forEach((a, i) => { s = s.split(`{${i}}`).join(String(a)); });
    return s;
}

export const DICT_FOR_TESTS = DICT;

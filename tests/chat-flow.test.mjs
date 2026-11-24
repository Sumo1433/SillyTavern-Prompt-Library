// Сценарии привязки к чатам через настоящий index.js с подменённой таверной
// (одноимённые чаты разных персонажей, ветки, переименование, старые привязки).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = new URL('../', import.meta.url);
const handlers = {};
const settings = {};
// состояние «таверны»: открытый чат = { file, integrity, owner, main_chat }
const st = { file: '', integrity: '', groupId: null, avatar: 'A.png', meta: {} };
const ctxObj = () => ({
    extensionSettings: settings,
    extensionPrompts: {},
    chatMetadata: st.meta,
    getCurrentChatId: () => st.file,
    getCurrentLocale: () => 'en',
    groupId: st.groupId,
    characterId: 0,
    characters: [{ avatar: st.avatar }],
    saveSettingsDebounced() {},
    saveMetadataDebounced() {},
    setExtensionPrompt() {},
    eventTypes: { CHAT_CHANGED: 'changed', APP_READY: 'ready', GENERATION_AFTER_COMMANDS: 'gen', CHAT_RENAMED: 'renamed' },
    eventSource: { on: (k, f) => { handlers[k] = f; } },
});
globalThis.SillyTavern = { getContext: ctxObj };
globalThis.document = { getElementById: () => null };
globalThis.jQuery = fn => fn();
globalThis.window = {};

const S = await import(new URL('src/state.js', base));
let src = fs.readFileSync(new URL('index.js', base), 'utf8').replaceAll("'./src/", `'${new URL('src/', base).href}`);
src = src.replace(/import \{ buildPanel, openPanel, refresh \} from '[^']+';/, 'const buildPanel = () => {}, openPanel = () => {}, refresh = () => {};');
await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

/** Открыть чат в «таверне» и отправить CHAT_CHANGED. */
function open({ file, integrity, avatar = 'A.png', groupId = null, main_chat }) {
    Object.assign(st, { file, avatar, groupId, meta: { integrity, ...(main_chat ? { main_chat } : {}) } });
    handlers.changed();
}
/** Переименование: таверна перезагружает чат (CHAT_CHANGED), потом шлёт CHAT_RENAMED. */
function rename(newFile) {
    st.file = newFile;
    handlers.changed();
    handlers.renamed?.({ oldFileName: 'x.jsonl', newFileName: newFile + '.jsonl' });
}
const entry = () => settings.promptLibrary.entries[0];
const reset = () => {
    const e = entry();
    Object.assign(e, { text: 'TEST', enabled: true, scope: 'all', excludeChats: [], onlyChats: [] });
    settings.promptLibrary.branchesDone = [];
};

test('одноимённые чаты разных персонажей не делят исключение', () => {
    reset();
    open({ file: 'Main', integrity: 'uuid-A', avatar: 'A.png' });
    S.setChatToggle(entry(), S.currentChatId(), false);
    assert.equal(S.isActive(entry()), false);
    open({ file: 'Main', integrity: 'uuid-B', avatar: 'B.png' });
    assert.equal(S.isActive(entry()), true);
});

test('«только выбранные» не включается в одноимённом чужом чате', () => {
    reset();
    entry().scope = 'only';
    open({ file: 'Main', integrity: 'uuid-A', avatar: 'A.png' });
    S.setChatToggle(entry(), S.currentChatId(), true);
    assert.equal(S.isActive(entry()), true);
    open({ file: 'Main', integrity: 'uuid-B', avatar: 'B.png' });
    assert.equal(S.isActive(entry()), false);
});

test('ветка наследует исключение родителя', () => {
    reset();
    open({ file: 'Story', integrity: 'p-uuid' });
    S.setChatToggle(entry(), S.currentChatId(), false);
    open({ file: 'Story - Branch #1', integrity: 'b-uuid', main_chat: 'Story' });
    assert.equal(S.isActive(entry()), false);
});

test('переименование ветки не возвращает настройки родителя', () => {
    reset();
    open({ file: 'Story', integrity: 'p-uuid' });
    S.setChatToggle(entry(), S.currentChatId(), false);
    open({ file: 'Story - Branch #1', integrity: 'b-uuid', main_chat: 'Story' });
    S.setChatToggle(entry(), S.currentChatId(), true);   // включили в ветке
    assert.equal(S.isActive(entry()), true);
    rename('Совсем другое имя: очень длинное ' + 'x'.repeat(300));
    assert.equal(S.isActive(entry()), true);
    // и после возврата в родителя и обратно — тоже
    open({ file: 'Story', integrity: 'p-uuid' });
    assert.equal(S.isActive(entry()), false);
    open({ file: 'Совсем другое имя', integrity: 'b-uuid', main_chat: 'Story' });
    assert.equal(S.isActive(entry()), true);
});

test('переименование обычного чата сохраняет привязку', () => {
    reset();
    open({ file: 'Chat', integrity: 'c-uuid' });
    S.setChatToggle(entry(), S.currentChatId(), false);
    rename('Chat renamed? <weird> name.');
    assert.equal(S.isActive(entry()), false);
});

test('ветка, открытая не из родителя, не наследует, но и не наследует потом', () => {
    reset();
    open({ file: 'Story', integrity: 'p-uuid' });
    S.setChatToggle(entry(), S.currentChatId(), false);
    open({ file: 'Other', integrity: 'o-uuid' });
    open({ file: 'Story - Branch #2', integrity: 'b2-uuid', main_chat: 'Story' });
    assert.equal(S.isActive(entry()), true);
    open({ file: 'Story', integrity: 'p-uuid' });
    open({ file: 'Story - Branch #2', integrity: 'b2-uuid', main_chat: 'Story' });
    assert.equal(S.isActive(entry()), true);
});

test('ветка чужого персонажа с тем же именем родителя не наследует', () => {
    reset();
    open({ file: 'Story', integrity: 'p-uuid', avatar: 'A.png' });
    S.setChatToggle(entry(), S.currentChatId(), false);
    open({ file: 'Story - Branch #1', integrity: 'x-uuid', avatar: 'B.png', main_chat: 'Story' });
    assert.equal(S.isActive(entry()), true);
});

test('старая привязка по имени файла переносится на ключ при открытии', () => {
    reset();
    entry().excludeChats = ['Legacy chat'];
    open({ file: 'Legacy chat', integrity: 'l-uuid' });
    assert.deepEqual(entry().excludeChats, ['l-uuid']);
    assert.equal(S.isActive(entry()), false);
});

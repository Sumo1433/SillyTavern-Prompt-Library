// Юнит-тесты логики библиотеки: node --test tests/
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const injected = {};
let chatId = 'chat-1';
const settings = {};
globalThis.SillyTavern = {
    getContext: () => ({
        extensionSettings: settings,
        extensionPrompts: injected,
        saveSettingsDebounced: () => {},
        getCurrentChatId: () => chatId,
        getCurrentLocale: () => 'ru-ru',
        setExtensionPrompt: (key, value, position, depth, scan, role) => {
            injected[key] = { value, position, depth, scan, role };
        },
    }),
};

const S = await import('../src/state.js');
const I = await import('../src/i18n.js');

beforeEach(() => {
    for (const k of Object.keys(settings)) delete settings[k];
    for (const k of Object.keys(injected)) delete injected[k];
    chatId = 'chat-1';
});

test('первый запуск: одна пустая выключенная запись', () => {
    const s = S.store('Новый промт');
    assert.equal(s.entries.length, 1);
    assert.equal(s.entries[0].enabled, false);
    assert.equal(s.entries[0].text, '');
    assert.equal(s.entries[0].name, 'Новый промт');
    S.syncInjections();
    assert.deepEqual(Object.keys(injected), []);
});

test('после удаления всех записей шаблон не возвращается', () => {
    const s = S.store('x');
    s.entries.length = 0;
    S.store('x');
    assert.equal(S.entries().length, 0);
});

test('выключенная или пустая запись не инжектится', () => {
    const s = S.store('x');
    s.entries[0].text = 'hello';
    S.syncInjections();
    assert.equal(Object.keys(injected).length, 0);
    s.entries[0].enabled = true;
    s.entries[0].text = '   ';
    S.syncInjections();
    assert.equal(Object.keys(injected).length, 0);
});

test('включённая запись инжектится с позицией, глубиной и ролью', () => {
    const s = S.store('x');
    Object.assign(s.entries[0], { enabled: true, text: 'A', position: S.POS.IN_CHAT, depth: 2, role: S.ROLE.USER });
    S.syncInjections();
    const vals = Object.values(injected);
    assert.equal(vals.length, 1);
    assert.deepEqual(vals[0], { value: 'A', position: 1, depth: 2, scan: false, role: 1 });
});

test('выключение убирает инжект, чужие ключи не трогаются', () => {
    injected.other_ext = { value: 'keep' };
    const s = S.store('x');
    Object.assign(s.entries[0], { enabled: true, text: 'A' });
    S.syncInjections();
    s.entries[0].enabled = false;
    S.syncInjections();
    assert.deepEqual(Object.keys(injected), ['other_ext']);
});

test('порядок ключей совпадает с порядком библиотеки', () => {
    const s = S.store('x');
    s.entries = ['B', 'A', 'C'].map(t => S.newEntry(t, { enabled: true, text: t }));
    S.syncInjections();
    const order = Object.keys(injected).sort().map(k => injected[k].value);
    assert.deepEqual(order, ['B', 'A', 'C']);
});

test('исключение для чата: «все чаты» минус этот', () => {
    const s = S.store('x');
    const e = s.entries[0];
    Object.assign(e, { enabled: true, text: 'A' });
    assert.equal(S.chatToggleState(e, 'chat-1'), true);
    S.setChatToggle(e, 'chat-1', false);
    assert.deepEqual(e.excludeChats, ['chat-1']);
    assert.equal(S.isActive(e, 'chat-1'), false);
    assert.equal(S.isActive(e, 'chat-2'), true);
    S.setChatToggle(e, 'chat-1', true);
    assert.deepEqual(e.excludeChats, []);
});

test('режим «только выбранные»', () => {
    const s = S.store('x');
    const e = s.entries[0];
    Object.assign(e, { enabled: true, text: 'A', scope: 'only' });
    assert.equal(S.isActive(e, 'chat-1'), false);
    S.setChatToggle(e, 'chat-1', true);
    assert.equal(S.isActive(e, 'chat-1'), true);
    assert.equal(S.isActive(e, 'chat-2'), false);
    assert.equal(S.isActive(e, ''), false);
});

test('normalizeEntry чинит мусор', () => {
    const e = S.normalizeEntry({ position: 9, role: 'x', depth: -5, enabled: 'yes', excludeChats: ['a', 'a', 3] });
    assert.equal(e.position, S.POS.IN_CHAT);
    assert.equal(e.role, S.ROLE.SYSTEM);
    assert.equal(e.depth, 0);
    assert.equal(e.enabled, false);
    assert.deepEqual(e.excludeChats, ['a']);
    assert.equal(S.normalizeEntry({ depth: 1e9 }).depth, S.MAX_DEPTH);
});

test('дубли id исправляются', () => {
    settings.promptLibrary = { initialized: true, entries: [{ id: 'same', text: 'a' }, { id: 'same', text: 'b' }] };
    const s = S.store('x');
    assert.notEqual(s.entries[0].id, s.entries[1].id);
});

test('экспорт без привязок к чатам, импорт — новые id и «все чаты»', () => {
    const s = S.store('x');
    Object.assign(s.entries[0], { name: 'N', text: 'T', enabled: true, excludeChats: ['c'] });
    const data = S.exportData();
    assert.equal(data.entries[0].excludeChats, undefined);
    const back = S.parseImport(JSON.parse(JSON.stringify(data)));
    assert.equal(back.length, 1);
    assert.notEqual(back[0].id, s.entries[0].id);
    assert.equal(back[0].text, 'T');
    assert.equal(back[0].scope, 'all');
    assert.deepEqual(S.parseImport({ foo: 1 }), []);
    assert.equal(S.parseImport([{ text: 'a' }, null, 5]).length, 1);
});

test('язык: точное совпадение с языками таверны', () => {
    assert.equal(I.lang(), 'ru');
    assert.equal(I.t('subtitle', 1, 2), 'Активно: 1 из 2');
});

test('словарь: у каждого ключа есть все языки', () => {
    for (const [k, row] of Object.entries(I.DICT_FOR_TESTS)) {
        for (const l of ['en', 'ru', 'uk', 'zh']) assert.ok(row[l], `${k}.${l}`);
    }
});

# Prompt Library for SillyTavern

[Русский](README.ru.md)

A library of your own prompts. Think of it as Author's Note with as many entries as you like, all kept in one place. Prompts live in the extension settings, so switching chat, character, preset, API or model never loses them.

## Features

- A dedicated window from the wand menu (🪄 → **Prompt Library**).
- Each entry has a **toggle**, **name**, **prompt text**, **injection type**, **depth** and **role**.
  - *In chat @ depth N*: same as Author's Note (0 = after the last message).
  - *Before* or *after* the main prompt / story string.
- An entry that is switched off or has empty text is **never sent**.
- Entries apply to **all chats** by default. The editor has an “Active in this chat” toggle to turn an entry off just here. “Only selected chats” mode limits an entry to the chats you tick.
- Add, duplicate, delete, drag to reorder, and search by name or text.
- Export and import the library as JSON (per-chat settings are not exported).
- Macros such as `{{char}}` and `{{user}}` work.
- The UI follows the SillyTavern language: English, Russian, Ukrainian, Chinese (Simplified; Traditional Chinese also gets Simplified).
- Colors come from your active theme, and on phones the window opens full screen.

## Install

Extensions → Install extension → paste:

```
https://github.com/Sumo1433/SillyTavern-Prompt-Library
```

## How it works

The extension uses SillyTavern's built-in `setExtensionPrompt`, the same mechanism as Author's Note. That's why it works with Chat Completion and Text Completion and with any preset. Even if the preset disables Main Prompt, the before/after main prompt positions still land in place.

## Author

Deadsum — [t.me/Deadsum](https://t.me/Deadsum). MIT license.

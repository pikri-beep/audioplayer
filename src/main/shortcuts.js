const { globalShortcut } = require('electron');
const state = require('./state');
const { safeSend } = require('./windowManager');

function registerGlobalShortcuts() {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
        if (state.win && !state.win.isDestroyed()) {
            safeSend(state.win, "thumb-play");
        }
    });
    globalShortcut.register('CommandOrControl+Right', () => {
        if (state.win && !state.win.isDestroyed()) {
            safeSend(state.win, "thumb-next");
        }
    });
    globalShortcut.register('CommandOrControl+Left', () => {
        if (state.win && !state.win.isDestroyed()) {
            safeSend(state.win, "thumb-prev");
        }
    });
    globalShortcut.register('CommandOrControl+M', () => {
        if (state.win && !state.win.isDestroyed()) {
            safeSend(state.win, 'shortcut-mute');
        }
    });
}

function unregisterGlobalShortcuts() {
    globalShortcut.unregisterAll();
}

module.exports = {
    registerGlobalShortcuts,
    unregisterGlobalShortcuts
};

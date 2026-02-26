const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Minimal DOM shim
const elementStore = {};
const mockElement = (id) => ({
    id: id,
    textContent: '',
    innerHTML: '',
    classList: { toggle: () => {}, remove: () => {}, add: () => {}, contains: () => false },
    onclick: null,
    contains: () => false,
});

global.window = global;
global.document = {
    getElementById: (id) => {
        if (!elementStore[id]) elementStore[id] = mockElement(id);
        return elementStore[id];
    },
    querySelector: () => mockElement('mock'),
    createElement: (tag) => {
        const el = mockElement(tag);
        el.getContext = () => null;
        el.click = () => {};
        el.width = 0;
        el.height = 0;
        return el;
    },
    body: { appendChild: () => {}, removeChild: () => {} },
    addEventListener: () => {},
};
global.Image = class { set src(v) { if (this.onerror) this.onerror(); } };
global.alert = () => {};
global.FirebaseService = { getActivePlayerDatabase: () => ({}) };
global.XLSX = {
    utils: { book_new: () => ({}), json_to_sheet: () => ({}), book_append_sheet: () => {} },
    writeFile: () => {},
};

// Load the module
require('../js/features/generator/download-controller.js');

describe('DSDownloadController', () => {
    it('exports all expected methods', () => {
        const ctrl = global.DSDownloadController;
        assert.ok(ctrl, 'DSDownloadController should be defined');
        assert.equal(typeof ctrl.openDownloadModal, 'function');
        assert.equal(typeof ctrl.closeDownloadModal, 'function');
        assert.equal(typeof ctrl.downloadTeamExcel, 'function');
        assert.equal(typeof ctrl.downloadTeamMap, 'function');
        assert.equal(typeof ctrl.getMapHeaderTitle, 'function');
        assert.equal(typeof ctrl.getActiveEventAvatarDataUrl, 'function');
        assert.equal(typeof ctrl.loadActiveEventAvatarForHeader, 'function');
        assert.equal(typeof ctrl.fitCanvasHeaderText, 'function');
        assert.equal(typeof ctrl.drawGeneratedMapHeader, 'function');
        assert.equal(typeof ctrl.generateMapWithoutBackground, 'function');
        assert.equal(typeof ctrl.generateMap, 'function');
    });

    it('getMapHeaderTitle returns correct format for team A', () => {
        const deps = {
            getCurrentEvent: () => 'desert_storm',
            getEventDisplayName: () => 'Desert Storm',
        };
        const title = global.DSDownloadController.getMapHeaderTitle('A', deps);
        assert.equal(title, 'TEAM A ASSIGNMENTS - Desert Storm');
    });

    it('getMapHeaderTitle returns correct format for team B', () => {
        const deps = {
            getCurrentEvent: () => 'canyon_storm',
            getEventDisplayName: () => 'Canyon Storm',
        };
        const title = global.DSDownloadController.getMapHeaderTitle('B', deps);
        assert.equal(title, 'TEAM B ASSIGNMENTS - Canyon Storm');
    });

    it('getActiveEventAvatarDataUrl returns empty string when no event', () => {
        const deps = {
            getActiveEvent: () => null,
            isImageDataUrl: () => false,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = global.DSDownloadController.getActiveEventAvatarDataUrl(deps);
        assert.equal(result, '');
    });

    it('getActiveEventAvatarDataUrl returns empty string when logoDataUrl is not a string', () => {
        const deps = {
            getActiveEvent: () => ({ logoDataUrl: 123 }),
            isImageDataUrl: () => false,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = global.DSDownloadController.getActiveEventAvatarDataUrl(deps);
        assert.equal(result, '');
    });

    it('getActiveEventAvatarDataUrl returns empty for empty logo', () => {
        const deps = {
            getActiveEvent: () => ({ logoDataUrl: '   ' }),
            isImageDataUrl: () => false,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = global.DSDownloadController.getActiveEventAvatarDataUrl(deps);
        assert.equal(result, '');
    });

    it('getActiveEventAvatarDataUrl returns data url when valid', () => {
        const dataUrl = 'data:image/png;base64,abc123';
        const deps = {
            getActiveEvent: () => ({ logoDataUrl: dataUrl }),
            isImageDataUrl: (val) => val === dataUrl,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = global.DSDownloadController.getActiveEventAvatarDataUrl(deps);
        assert.equal(result, dataUrl);
    });

    it('loadActiveEventAvatarForHeader returns null when no avatar', async () => {
        const deps = {
            getActiveEvent: () => null,
            isImageDataUrl: () => false,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = await global.DSDownloadController.loadActiveEventAvatarForHeader(deps);
        assert.equal(result, null);
    });

    it('closeDownloadModal calls setActiveDownloadTeam with null', () => {
        let calledWith = undefined;
        const deps = {
            setActiveDownloadTeam: (v) => { calledWith = v; },
            closeModalOverlay: () => {},
        };
        global.DSDownloadController.closeDownloadModal(deps);
        assert.equal(calledWith, null);
    });

    it('downloadTeamExcel alerts when no assignments', async () => {
        let alertCalled = false;
        global.alert = () => { alertCalled = true; };
        const deps = {
            ensureXLSXLoaded: async () => {},
            t: (key) => key,
            showMessage: () => {},
            getAssignmentsA: () => [],
            getAssignmentsB: () => [],
        };
        await global.DSDownloadController.downloadTeamExcel('A', deps);
        assert.ok(alertCalled);
    });

    it('downloadTeamMap alerts when no assignments', async () => {
        let alertCalled = false;
        global.alert = () => { alertCalled = true; };
        const deps = {
            t: (key) => key,
            showMessage: () => {},
            getAssignmentsA: () => [],
            getAssignmentsB: () => [],
        };
        await global.DSDownloadController.downloadTeamMap('B', deps);
        assert.ok(alertCalled);
    });

    it('fitCanvasHeaderText returns original text when maxWidth is non-finite', () => {
        const result = global.DSDownloadController.fitCanvasHeaderText({}, 'hello', NaN, 'bold 40px Arial');
        assert.equal(result, 'hello');
    });

    it('fitCanvasHeaderText returns original text when maxWidth is zero', () => {
        const result = global.DSDownloadController.fitCanvasHeaderText({}, 'hello', 0, 'bold 40px Arial');
        assert.equal(result, 'hello');
    });
});

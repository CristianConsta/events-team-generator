(function initShellNavigationController(global) {
    const SUPPORTED_VIEWS = new Set(['generator', 'configuration', 'players', 'alliance', 'support']);

    function normalizeView(view) {
        const next = typeof view === 'string' ? view.trim().toLowerCase() : '';
        return SUPPORTED_VIEWS.has(next) ? next : 'generator';
    }

    function syncMenuVisibility(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const panel = settings.panel || null;
        const menuButton = settings.menuButton || null;
        const setPanelVisibility = typeof settings.setPanelVisibility === 'function'
            ? settings.setPanelVisibility
            : null;
        const open = settings.open === true;

        if (panel && setPanelVisibility) {
            setPanelVisibility(panel, open);
        }
        if (menuButton && typeof menuButton.setAttribute === 'function') {
            menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
    }

    function syncNavigationButtons(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const currentView = normalizeView(settings.currentView);
        const entries = Array.isArray(settings.entries)
            ? settings.entries
            : Object.keys(settings.buttons && typeof settings.buttons === 'object' ? settings.buttons : {})
                .map(function mapButtons(view) {
                    return { view: view, button: settings.buttons[view] };
                });

        entries.forEach(function eachEntry(entry) {
            const view = normalizeView(entry && entry.view);
            const button = entry && entry.button;
            if (!button || !button.classList || typeof button.setAttribute !== 'function') {
                return;
            }
            const isActive = currentView === view;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }

    function applyPageVisibility(options) {
        const settings = options && typeof options === 'object' ? options : {};
        const currentView = normalizeView(settings.currentView);
        const pages = settings.pages && typeof settings.pages === 'object' ? settings.pages : {};

        Object.keys(pages).forEach(function eachKey(view) {
            const page = pages[view];
            if (!page || !page.classList) {
                return;
            }
            page.classList.toggle('hidden', view !== currentView);
        });

        return currentView;
    }

    global.DSShellNavigationController = {
        normalizeView: normalizeView,
        syncMenuVisibility: syncMenuVisibility,
        syncNavigationButtons: syncNavigationButtons,
        applyPageVisibility: applyPageVisibility,
    };
})(window);

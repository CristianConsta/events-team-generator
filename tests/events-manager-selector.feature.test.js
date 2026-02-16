const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/features/events-manager/event-selector-view.js');

function reset() {
  delete require.cache[require.resolve(modulePath)];
}

function loadModule() {
  global.window = global;
  delete global.DSFeatureEventsManagerSelector;
  reset();
  require(modulePath);
}

function createFakeDocument(container) {
  return {
    createElement(tagName) {
      return {
        tagName,
        className: '',
        type: '',
        dataset: {},
        textContent: '',
        listeners: {},
        addEventListener(event, handler) {
          this.listeners[event] = handler;
        },
        click() {
          if (typeof this.listeners.click === 'function') {
            this.listeners.click();
          }
        },
      };
    },
    getElementById(id) {
      return id === 'selector' ? container : null;
    },
  };
}

function createFakeContainer() {
  const container = {
    children: [],
    _innerHTML: 'stale',
    appendChild(node) {
      this.children.push(node);
    },
  };

  Object.defineProperty(container, 'innerHTML', {
    get() {
      return this._innerHTML;
    },
    set(value) {
      this._innerHTML = value;
      this.children = [];
    },
  });

  return container;
}

test('events manager selector resolves display name with fallback chain', () => {
  loadModule();

  const directName = global.DSFeatureEventsManagerSelector.resolveEventDisplayName('desert_storm', {
    getEvent() {
      return { name: 'Desert Storm' };
    },
    translate(key) {
      return `x:${key}`;
    },
  });
  assert.equal(directName, 'Desert Storm');

  const translatedTitle = global.DSFeatureEventsManagerSelector.resolveEventDisplayName('canyon', {
    getEvent() {
      return { name: '', titleKey: 'event_canyon_battlefield' };
    },
    translate(key) {
      return key === 'event_canyon_battlefield' ? 'Canyon Storm' : key;
    },
  });
  assert.equal(translatedTitle, 'Canyon Storm');

  const fallback = global.DSFeatureEventsManagerSelector.resolveEventDisplayName('unknown_event', {
    getEvent() {
      return null;
    },
  });
  assert.equal(fallback, 'unknown_event');
});

test('events manager selector renders buttons and emits selection callback', () => {
  loadModule();

  const selected = [];
  const container = createFakeContainer();
  const fakeDocument = createFakeDocument(container);

  global.DSFeatureEventsManagerSelector.renderEventSelector({
    document: fakeDocument,
    containerId: 'selector',
    eventIds: ['desert_storm', 'canyon_battlefield'],
    currentEvent: 'canyon_battlefield',
    getDisplayName(eventId) {
      return eventId === 'desert_storm' ? 'Desert Storm' : 'Canyon Storm';
    },
    onSelect(eventId) {
      selected.push(eventId);
    },
  });

  assert.equal(container.children.length, 2);
  assert.equal(container.children[0].className, 'event-btn');
  assert.equal(container.children[1].className, 'event-btn active');
  assert.equal(container.children[0].textContent, 'Desert Storm');
  assert.equal(container.children[1].textContent, 'Canyon Storm');

  container.children[0].click();
  container.children[1].click();
  assert.deepEqual(selected, ['desert_storm', 'canyon_battlefield']);
});

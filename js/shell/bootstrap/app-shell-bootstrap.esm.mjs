export function bootApplication() {
  if (typeof window.initializeApplicationUiRuntime === 'function') {
    window.initializeApplicationUiRuntime();
  }
}

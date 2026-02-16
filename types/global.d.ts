declare global {
  interface Window {
    initializeApplicationUiRuntime?: () => void;
  }
}

export {};

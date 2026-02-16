import { bootApplication } from './shell/bootstrap/app-shell-bootstrap.esm.mjs';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApplication, { once: true });
} else {
  bootApplication();
}

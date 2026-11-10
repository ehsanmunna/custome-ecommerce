// Browser polyfill for process.env used by app.config.ts.
// Angular CLI webpack does not define process.env in the browser.
// When ADMIN_API_BASE_URL is set at build time (via environment), it
// should be inlined here. Otherwise it falls back to the default in
// auth.config.ts.
if (typeof process === 'undefined') {
  (window as any).process = { env: {} };
}

/* Applied before first paint (loaded synchronously in <head>) so neither the
   colour theme nor the pixel-font choice flashes on load. Kept tiny on purpose. */
(function () {
  try {
    var d = document.documentElement;
    var t = localStorage.getItem('dos-theme') || 'dos';
    d.setAttribute('data-theme', t);

    var f = localStorage.getItem('dos-font') || 'pixel';
    d.setAttribute('data-font', f);

    // The theme reveals <body> from JS; make sure it is never left hidden
    // if a later script fails to run.
    d.classList.add('js-theme-ready');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dos');
    document.documentElement.setAttribute('data-font', 'system');
  }
})();

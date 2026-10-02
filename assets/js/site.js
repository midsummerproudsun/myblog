/* ==========================================================================
   Site enhancements — vanilla JS, no dependencies.
   Everything is progressive: with JS off the site still reads fine.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var $  = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  var THEMES = [
    { id: 'dos',   name: '经典 DOS 蓝', colors: ['#000084', '#fefe54'] },
    { id: 'amber', name: '琥珀单色',    colors: ['#100800', '#ffb000'] },
    { id: 'green', name: '绿磷光',      colors: ['#000a00', '#33ff33'] },
    { id: 'paper', name: '纸质浅色',    colors: ['#f4f1e8', '#242424'] }
  ];

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  /* ------------------------------------------------------------------ *
   * 1. Theme switching
   * ------------------------------------------------------------------ */
  function setTheme(id) {
    root.setAttribute('data-theme', id);
    store('dos-theme', id);
    $$('#theme-menu button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.theme === id));
    });
  }

  function buildThemeMenu() {
    var menu = $('#theme-menu');
    if (!menu) return;
    menu.innerHTML = '';
    THEMES.forEach(function (t) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', String(root.getAttribute('data-theme') === t.id));
      b.dataset.theme = t.id;
      var sw = doc.createElement('span');
      sw.className = 'swatch';
      sw.style.background = t.colors[0];
      sw.style.borderColor = t.colors[1];
      b.appendChild(sw);
      b.appendChild(doc.createTextNode(t.name));
      b.addEventListener('click', function () {
        setTheme(t.id);
        menu.classList.remove('is-open');
        var btn = $('#theme-btn');
        if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      });
      menu.appendChild(b);
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Pixel-font toggle (users on slow links can opt out)
   * ------------------------------------------------------------------ */
  function setFont(mode) {
    root.setAttribute('data-font', mode);
    store('dos-font', mode);
    var btn = $('#font-btn');
    if (btn) {
      var pixel = mode === 'pixel';
      btn.setAttribute('aria-pressed', String(pixel));
      btn.textContent = pixel ? '字:像素' : '字:系统';
      btn.title = pixel ? '当前使用像素字体，点击切换为系统字体' : '当前使用系统字体，点击切换为像素字体';
    }
  }

  /* ------------------------------------------------------------------ *
   * 3. Mobile menu
   * ------------------------------------------------------------------ */
  function initMenu() {
    var btn = $('#menu-btn');
    var nav = $('#site-nav-collapse');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. Search — DOS command line over a static JSON index
   * ------------------------------------------------------------------ */
  var searchState = { items: null, loading: false, results: [], active: -1, opener: null };

  function loadIndex(url, cb) {
    if (searchState.items) { cb(searchState.items); return; }
    if (searchState.loading) return;
    searchState.loading = true;
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (data) {
        searchState.items = (data && data.pages) || [];
        searchState.loading = false;
        cb(searchState.items);
      })
      .catch(function () {
        searchState.loading = false;
        cb([]);
      });
  }

  function score(item, terms) {
    var title = (item.title || '').toLowerCase();
    var text  = (item.text  || '').toLowerCase();
    var tags  = ((item.categories || []).concat(item.tags || [])).join(' ').toLowerCase();
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (!t) continue;
      var s = 0;
      if (title.indexOf(t) !== -1) s += 10;
      if (tags.indexOf(t)  !== -1) s += 4;
      if (text.indexOf(t)  !== -1) s += 1;
      if (s === 0) return 0;            // every term must hit something
      total += s;
    }
    return total;
  }

  function snippet(text, terms) {
    var lower = (text || '').toLowerCase();
    var at = -1;
    for (var i = 0; i < terms.length; i++) {
      at = lower.indexOf(terms[i]);
      if (at !== -1) break;
    }
    if (at === -1) return (text || '').slice(0, 90);
    var start = Math.max(0, at - 25);
    return (start > 0 ? '…' : '') + text.slice(start, start + 100) + '…';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function markTerms(s, terms) {
    var out = esc(s);
    terms.forEach(function (t) {
      if (!t) return;
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  function renderResults(terms) {
    var list = $('#search-results');
    if (!list) return;
    list.innerHTML = '';

    if (!terms.length) {
      list.innerHTML = '<li class="r-none">输入关键词开始搜索 · 例如「Godot」「像素」「跑团」</li>';
      searchState.results = []; searchState.active = -1;
      return;
    }
    if (!searchState.items || !searchState.items.length) {
      list.innerHTML = '<li class="r-none">索引不可用（请检查 /index.json 是否已生成）。</li>';
      return;
    }

    var hits = searchState.items
      .map(function (it) { return { it: it, s: score(it, terms) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 20);

    if (!hits.length) {
      list.innerHTML = '<li class="r-none">未找到匹配项。</li>';
      searchState.results = []; searchState.active = -1;
      return;
    }

    searchState.results = hits.map(function (h) { return h.it; });
    searchState.active = 0;

    hits.forEach(function (h, i) {
      var li = doc.createElement('li');
      var a = doc.createElement('a');
      a.href = h.it.link;
      a.dataset.idx = String(i);
      if (i === 0) a.classList.add('is-active');
      a.innerHTML =
        '<span class="r-title">' + markTerms(h.it.title, terms) + '</span>' +
        '<span class="r-sub">' + (h.it.date ? esc(h.it.date) + ' · ' : '') +
        markTerms(snippet(h.it.text, terms), terms) + '</span>';
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function moveActive(delta) {
    var links = $$('#search-results a');
    if (!links.length) return;
    searchState.active = (searchState.active + delta + links.length) % links.length;
    links.forEach(function (a, i) { a.classList.toggle('is-active', i === searchState.active); });
    var cur = links[searchState.active];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }

  function openSearch() {
    var ov = $('#search-overlay');
    if (!ov) return;
    searchState.opener = doc.activeElement;
    ov.classList.add('is-open');
    var input = $('#search-input');
    if (input) { input.value = ''; input.focus(); }
    renderResults([]);
    loadIndex(ov.dataset.indexUrl, function () { renderResults([]); });
  }

  function closeSearch() {
    var ov = $('#search-overlay');
    if (!ov) return;
    ov.classList.remove('is-open');
    if (searchState.opener && searchState.opener.focus) searchState.opener.focus();
  }

  function initSearch() {
    var ov = $('#search-overlay');
    if (!ov) return;
    var input = $('#search-input');

    var btn = $('#search-btn');
    if (btn) btn.addEventListener('click', openSearch);

    ov.addEventListener('click', function (e) { if (e.target === ov) closeSearch(); });

    var closeBtn = $('#search-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSearch);

    if (input) {
      input.addEventListener('input', function () {
        var terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
        renderResults(terms);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
        else if (e.key === 'Enter') {
          var links = $$('#search-results a');
          var target = links[searchState.active];
          if (target) { e.preventDefault(); location.href = target.href; }
        }
      });
    }

    // "/" or Ctrl/Cmd+K opens search, anywhere on the page
    doc.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''));
      if (e.key === 'Escape' && ov.classList.contains('is-open')) { closeSearch(); return; }
      if (typing) return;
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        openSearch();
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 5. ASCII reading-progress rail (articles only)
   * ------------------------------------------------------------------ */
  function initProgress() {
    var rail = $('#progress-rail');
    if (!rail) return;
    var fill = $('.rail-fill', rail);
    var pct  = $('.rail-pct', rail);
    var rows = 0;

    function build() {
      var h = rail.clientHeight - 34;
      rows = Math.max(8, Math.floor(h / 12));
      fill.textContent = new Array(rows + 1).join('░');
    }

    function update() {
      var body = doc.body;
      var max = (doc.documentElement.scrollHeight - window.innerHeight);
      var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      var n = Math.round(rows * ratio);
      fill.textContent = new Array(n + 1).join('█') + new Array(rows - n + 1).join('░');
      pct.textContent = String(Math.round(ratio * 100)) + '%';
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { update(); ticking = false; });
    }

    build();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { build(); update(); });
  }

  /* ------------------------------------------------------------------ *
   * 6. Bilibili embeds — click-to-load instead of auto-loading players
   * ------------------------------------------------------------------ */
  function initEmbeds() {
    $$('.bilibili-embed[data-bvid]').forEach(function (box) {
      if (box.dataset.loaded) return;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'bili-cover';
      btn.setAttribute('aria-label', '播放 B 站视频 ' + box.dataset.bvid);
      btn.innerHTML =
        '<span class="bili-play">▶</span>' +
        '<span class="bili-id">' + esc(box.dataset.bvid) + '</span>' +
        '<span class="bili-note">点击加载 B 站播放器</span>';
      btn.addEventListener('click', function () {
        var f = doc.createElement('iframe');
        f.src = 'https://player.bilibili.com/player.html?isOutside=true&bvid=' +
                encodeURIComponent(box.dataset.bvid) + '&page=1';
        f.title = box.dataset.title || ('Bilibili 视频 ' + box.dataset.bvid);
        f.setAttribute('scrolling', 'no');
        f.setAttribute('frameborder', '0');
        f.setAttribute('allow', 'fullscreen; autoplay; encrypted-media; picture-in-picture');
        f.setAttribute('allowfullscreen', '');
        box.innerHTML = '';
        box.appendChild(f);
        box.dataset.loaded = '1';
      });
      box.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------ *
   * 7. Copy button on code blocks
   * ------------------------------------------------------------------ */
  function initCopy() {
    $$('.post-content pre').forEach(function (pre) {
      if ($('.copy-btn', pre.parentNode) && pre.parentNode.classList.contains('code-wrap')) return;
      var wrap = doc.createElement('div');
      wrap.className = 'code-wrap';
      wrap.style.position = 'relative';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'copy-btn';
      b.textContent = '复制';
      b.addEventListener('click', function () {
        var text = pre.innerText;
        var done = function () {
          b.textContent = '已复制';
          b.classList.add('is-done');
          setTimeout(function () { b.textContent = '复制'; b.classList.remove('is-done'); }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
        } else { fallback(text, done); }
      });
      wrap.appendChild(b);
    });
    function fallback(text, done) {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      doc.body.appendChild(ta);
      ta.select();
      try { doc.execCommand('copy'); done(); } catch (e) { /* ignore */ }
      doc.body.removeChild(ta);
    }
  }

  /* ------------------------------------------------------------------ *
   * 8. Theme / font buttons + boot
   * ------------------------------------------------------------------ */
  function initTools() {
    buildThemeMenu();
    setFont(root.getAttribute('data-font') || 'pixel');
    setTheme(root.getAttribute('data-theme') || 'dos');

    var tBtn = $('#theme-btn'), tMenu = $('#theme-menu');
    if (tBtn && tMenu) {
      tBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = tMenu.classList.toggle('is-open');
        tBtn.setAttribute('aria-expanded', String(open));
      });
      doc.addEventListener('click', function () { tMenu.classList.remove('is-open'); tBtn.setAttribute('aria-expanded', 'false'); });
    }

    var fBtn = $('#font-btn');
    if (fBtn) {
      fBtn.addEventListener('click', function () {
        setFont(root.getAttribute('data-font') === 'pixel' ? 'system' : 'pixel');
      });
    }
  }

  function boot() {
    initTools();
    initMenu();
    initSearch();
    initProgress();
    initEmbeds();
    initCopy();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

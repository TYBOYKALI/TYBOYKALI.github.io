(function () {
  'use strict';
  var panel = document.getElementById('freya-companion');
  var reopen = document.getElementById('freya-show');
  if (!panel || !reopen) return;
  var character = panel.querySelector('.freya-character');
  var canvas = character.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var message = panel.querySelector('.freya-message');
  var atlas = new Image();
  var desktop = window.matchMedia('(min-width: 0px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ready = false, loading = false, collapsed = false;
  var timer, messageTimer, frame = 0, action = 'idle', until = 0, greetings = 0;
  var target = null, position = null, drag = null, suppressClickUntil = 0;
  var reopenPosition = null, reopenDrag = null;
  var states = { idle: {row: 0, count: 6}, waving: {row: 3, count: 4}, jumping: {row: 4, count: 5} };
  try {
    collapsed = localStorage.getItem('freya-collapsed') === '1';
    var saved = JSON.parse(localStorage.getItem('freya-position'));
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position = {x: clamp(saved.x, 0, 1), y: clamp(saved.y, 0, 1)};
    var savedReopen = JSON.parse(localStorage.getItem('freya-reopen-position'));
    if (savedReopen && Number.isFinite(savedReopen.x) && Number.isFinite(savedReopen.y)) reopenPosition = {x: clamp(savedReopen.x, 0, 1), y: clamp(savedReopen.y, 0, 1)};
  } catch (_) {}

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function limits() {
    return {x: Math.max(8, innerWidth - panel.offsetWidth - 8), y: Math.max(8, innerHeight - panel.offsetHeight - 8)};
  }
  function setPosition(x, y) {
    var bounds = limits();
    var left = clamp(x, 8, bounds.x), top = clamp(y, 8, bounds.y);
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    panel.style.left = left + 'px'; panel.style.top = top + 'px';
    position = {x: (left - 8) / Math.max(1, bounds.x - 8), y: (top - 8) / Math.max(1, bounds.y - 8)};
    placeMessage();
    render();
  }
  function restorePosition() {
    if (!position || panel.hidden) return;
    var bounds = limits();
    setPosition(8 + position.x * (bounds.x - 8), 8 + position.y * (bounds.y - 8));
  }
  function savePosition() {
    try { localStorage.setItem('freya-position', JSON.stringify(position)); } catch (_) {}
  }
  function setReopenPosition(x, y) {
    var maxX = Math.max(8, innerWidth - reopen.offsetWidth - 8);
    var maxY = Math.max(8, innerHeight - reopen.offsetHeight - 8);
    var left = clamp(x, 8, maxX), top = clamp(y, 8, maxY);
    reopen.style.right = 'auto'; reopen.style.bottom = 'auto';
    reopen.style.left = left + 'px'; reopen.style.top = top + 'px';
    reopenPosition = {x: (left - 8) / Math.max(1, maxX - 8), y: (top - 8) / Math.max(1, maxY - 8)};
  }
  function restoreReopenPosition() {
    if (!reopenPosition || reopen.hidden) return;
    var maxX = Math.max(8, innerWidth - reopen.offsetWidth - 8);
    var maxY = Math.max(8, innerHeight - reopen.offsetHeight - 8);
    setReopenPosition(8 + reopenPosition.x * (maxX - 8), 8 + reopenPosition.y * (maxY - 8));
  }
  function saveReopenPosition() {
    try { localStorage.setItem('freya-reopen-position', JSON.stringify(reopenPosition)); } catch (_) {}
  }
  function placeMessage() {
    if (panel.hidden) return;
    var box = panel.getBoundingClientRect();
    panel.classList.toggle('message-below', box.top < 150);
    panel.classList.toggle('message-align-left', box.left < 60);
  }
  function render() {
    if (!ready || panel.hidden) return;
    var state = states[action];
    var row = state.row, col = reduceMotion.matches ? 0 : frame % state.count;
    if (action === 'idle' && target) {
      var box = canvas.getBoundingClientRect();
      var dx = target.x - scrollX - (box.left + box.width / 2);
      var dy = target.y - scrollY - (box.top + box.height * .3);
      // The atlas starts at up, then proceeds clockwise: right=4, down=8, left=12.
      var direction = (Math.round(Math.atan2(dx, -dy) / (Math.PI * 2) * 16) + 16) % 16;
      row = 9 + Math.floor(direction / 8); col = direction % 8;
    }
    ctx.clearRect(0, 0, 192, 208);
    ctx.drawImage(atlas, col * 192, row * 208, 192, 208, 0, 0, 192, 208);
  }
  function tick() {
    if (document.hidden || !desktop.matches || collapsed || !ready) return;
    if (until && Date.now() >= until) { action = 'idle'; until = 0; frame = 0; }
    render(); frame++;
    // A selected direction stays in place until the next click.
    if (action !== 'idle' || (!target && !reduceMotion.matches)) timer = setTimeout(tick, 160);
  }
  function sync() {
    clearTimeout(timer);
    panel.hidden = !ready || !desktop.matches || collapsed;
    reopen.hidden = !ready || !desktop.matches || !collapsed;
    if (desktop.matches && !loading) { loading = true; atlas.src = character.dataset.sprite; }
    if (!reopen.hidden) restoreReopenPosition();
    if (!panel.hidden && !document.hidden) { restorePosition(); placeMessage(); tick(); }
  }
  function setCollapsed(value) {
    collapsed = value;
    try { localStorage.setItem('freya-collapsed', value ? '1' : '0'); } catch (_) {}
    sync();
  }
  atlas.onload = function () { ready = true; sync(); };
  atlas.onerror = function () { console.warn('看板娘素材加载失败'); };
  character.addEventListener('click', function (e) {
    if (Date.now() < suppressClickUntil) { e.preventDefault(); return; }
    action = greetings++ % 2 ? 'jumping' : 'waving'; frame = 0;
    until = Date.now() + states[action].count * 160 * 2;
    var lines = ['你好', '綾崎雫です。これからよろしくお願いします。', '阅读累了，也记得休息一下。'];
    message.textContent = lines[(greetings - 1) % lines.length]; message.hidden = false;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(function () { message.hidden = true; }, 4000);
    sync();
  });
  panel.querySelector('.freya-hide').addEventListener('click', function () { setCollapsed(true); reopen.focus(); });
  reopen.addEventListener('click', function (e) {
    if (Date.now() < suppressClickUntil) { e.preventDefault(); return; }
    setCollapsed(false); character.focus({preventScroll: true});
  });
  reopen.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || !e.isPrimary || reopen.hidden) return;
    var box = reopen.getBoundingClientRect();
    reopenDrag = {id: e.pointerId, x: e.clientX, y: e.clientY, left: box.left, top: box.top, moved: false};
    reopen.setPointerCapture(e.pointerId);
  });
  reopen.addEventListener('pointermove', function (e) {
    if (!reopenDrag || e.pointerId !== reopenDrag.id) return;
    var dx = e.clientX - reopenDrag.x, dy = e.clientY - reopenDrag.y;
    if (!reopenDrag.moved && Math.hypot(dx, dy) < 6) return;
    reopenDrag.moved = true; reopen.classList.add('is-dragging');
    setReopenPosition(reopenDrag.left + dx, reopenDrag.top + dy);
  });
  function finishReopenDrag(e) {
    if (!reopenDrag || e.pointerId !== reopenDrag.id) return;
    if (reopenDrag.moved) { suppressClickUntil = Date.now() + 350; saveReopenPosition(); }
    var pointerId = reopenDrag.id;
    reopenDrag = null; reopen.classList.remove('is-dragging');
    if (reopen.hasPointerCapture(pointerId)) reopen.releasePointerCapture(pointerId);
  }
  reopen.addEventListener('pointerup', finishReopenDrag);
  reopen.addEventListener('pointercancel', finishReopenDrag);
  reopen.addEventListener('lostpointercapture', finishReopenDrag);
  reopen.addEventListener('keydown', function (e) {
    var offsets = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    if (!offsets[e.key]) return;
    e.preventDefault();
    var box = reopen.getBoundingClientRect(), step = e.shiftKey ? 5 : 20;
    setReopenPosition(box.left + offsets[e.key][0] * step, box.top + offsets[e.key][1] * step);
    saveReopenPosition();
  });
  document.addEventListener('click', function (e) {
    if (!ready || collapsed || !desktop.matches || panel.contains(e.target) || reopen.contains(e.target) || Date.now() < suppressClickUntil) return;
    // Keyboard activation has no meaningful pointer coordinates.
    if (e.detail === 0) return;
    target = {x: e.pageX, y: e.pageY};
    action = 'idle'; until = 0; frame = 0;
    sync();
  });
  character.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || !e.isPrimary || panel.hidden) return;
    var box = panel.getBoundingClientRect();
    drag = {id: e.pointerId, x: e.clientX, y: e.clientY, left: box.left, top: box.top, moved: false};
    character.setPointerCapture(e.pointerId);
    character.focus({preventScroll: true});
  });
  character.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    panel.classList.add('is-dragging');
    setPosition(drag.left + dx, drag.top + dy);
  });
  function finishDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) { suppressClickUntil = Date.now() + 350; savePosition(); }
    var pointerId = drag.id;
    drag = null; panel.classList.remove('is-dragging');
    if (character.hasPointerCapture(pointerId)) character.releasePointerCapture(pointerId);
  }
  character.addEventListener('pointerup', finishDrag);
  character.addEventListener('pointercancel', finishDrag);
  character.addEventListener('lostpointercapture', finishDrag);
  character.addEventListener('keydown', function (e) {
    var offsets = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    if (!offsets[e.key]) return;
    e.preventDefault();
    var box = panel.getBoundingClientRect(), step = e.shiftKey ? 5 : 20;
    setPosition(box.left + offsets[e.key][0] * step, box.top + offsets[e.key][1] * step);
    savePosition();
  });
  window.addEventListener('resize', function () { restorePosition(); restoreReopenPosition(); placeMessage(); render(); });
  window.addEventListener('scroll', render, {passive: true});
  desktop.addEventListener('change', sync);
  reduceMotion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  sync();
})();

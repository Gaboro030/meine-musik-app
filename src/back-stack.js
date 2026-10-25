/* BackStack: makes the system back gesture / back button / browser back go BACK instead of closing the app.

   Rule: back undoes the most recent thing, in this order
     1. an open overlay (sheet, dialog, menu, language dropdown, update popup, lightbox)
     2. a state inside the current screen (search open, selection mode, filter panel, edit mode)
     3. navigation to the previous screen
     4. on the root screen: the system exits (default, keeps Android's predictive back animation).
        With init({ confirmExit: true }) the first back shows "press back again to exit", the second exits.

   API
     BackStack.push(id, onBack)     register an overlay/state right when it opens. onBack() must close it.
                                    returns a function: call it when you close it yourself (X button, backdrop...).
     BackStack.pop(id)              same as the returned function
     BackStack.navigate(route, data)  go to a screen (adds a history entry)
     BackStack.replace(route, data)   change the screen without a new entry (tab switches at the root)
     BackStack.onRoute(fn)          fn({route, data, direction}) is called for every screen change; render from it
     BackStack.root(route)          set the root screen (default 'home'); back from here asks to exit
     BackStack.exit(fn)             what "exit" means: Capacitor App.exitApp, Android bridge, window.close ...
     BackStack.onExitHint(fn)       show the "press back again" toast; fn(t) with t = ms to keep it visible
     BackStack.canGoBack()
     BackStack.init({ root, exitWindowMs, confirmExit })
     BackStack.onChange(fn)         fn(canGoBack) after every change (also forwarded to window.Native.setCanGoBack
                                    and to a 'backstate' event, so a native shell enables its back callback only when needed)

   Native shells call window.__nativeBack() from their back handler (Android OnBackPressedCallback / Capacitor
   backButton / Tauri); it returns true when it handled the press and false when the app should exit.
   Example for Capacitor:
     App.addListener('backButton', () => { if (!window.__nativeBack()) App.exitApp(); });

   One history entry per overlay and per screen. Esc closes the top overlay on desktop as well.
   With confirmExit a sentinel entry sits below the root so the root back is catchable. */
(function (global) {
  'use strict';

  var overlays = [];            // [{ id, onBack }]
  var routeFn = null, exitFn = null, hintFn = null;
  var rootRoute = 'home';
  var exitWindowMs = 2000;
  var confirmExit = false;
  var changeFns = [];
  var lastCan = null;
  var lastBackAt = 0;
  var current = { route: 'home', data: null };
  var depth = 0;                // screens above the root
  var skipPops = 0;             // popstates we caused ourselves (history.go(-n) when closing programmatically)
  var started = false;

  function state(kind, extra) { return Object.assign({ bs: kind, route: current.route, data: current.data }, extra || {}); }
  function emit(direction) { if (routeFn) routeFn({ route: current.route, data: current.data, direction: direction, depth: depth }); }

  function init(o) {
    o = o || {};
    if (o.root) rootRoute = o.root;
    if (o.exitWindowMs) exitWindowMs = o.exitWindowMs;
    if (o.confirmExit) confirmExit = true;
    if (started) return;
    started = true;
    current = { route: rootRoute, data: null };
    // sentinel (kept below the root entry) so back from the root is catchable instead of leaving the page
    if (confirmExit) {
      history.replaceState({ bs: 'sentinel' }, '');
      history.pushState(state('root'), '');
    } else {
      history.replaceState(state('root'), '');
    }
    addEventListener('popstate', onPop);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlays.length && !e.defaultPrevented) { e.preventDefault(); history.back(); }   // popstate closes the top overlay
    });
    global.__nativeBack = function () {                // for native back handlers; returns true when handled
      if (overlays.length || depth > 0) { history.back(); return true; }
      return confirmExit ? handleRootBack() : false;
    };
    notify();
  }

  function onPop(e) {
    if (skipPops > 0) { skipPops--; return; }
    var s = e.state || {};
    if (s.bs === 'sentinel') {                          // we are below the root: this was a back from the root
      history.pushState(state('root'), '');             // restore the root entry first
      handleRootBack();
      return;
    }
    // The entry we landed on is older than the one we left, so something was undone.
    if (overlays.length) {
      var top = overlays.pop();
      try { top.onBack(); } catch (err) { console.error('[BackStack] onBack failed', err); }
      notify();
      return;
    }
    if (depth > 0) {
      depth--;
      current = { route: s.route || rootRoute, data: s.data || null };
      emit('back');
      notify();
      return;
    }
    current = { route: rootRoute, data: null };
    emit('back');
    notify();
  }

  function canGoBack() { return overlays.length > 0 || depth > 0 || confirmExit; }
  function notify() {
    var can = canGoBack();
    if (can === lastCan) return;
    lastCan = can;
    try { if (global.Native && typeof global.Native.setCanGoBack === 'function') global.Native.setCanGoBack(can); } catch (e) { /* no native shell */ }
    try { global.dispatchEvent(new CustomEvent('backstate', { detail: { canGoBack: can } })); } catch (e) { /* old engine */ }
    changeFns.forEach(function (fn) { try { fn(can); } catch (err) { console.error(err); } });
  }

  function handleRootBack() {
    var now = Date.now();
    if (now - lastBackAt < exitWindowMs) { if (exitFn) exitFn(); else history.go(-2); return false; }
    lastBackAt = now;
    if (hintFn) hintFn(exitWindowMs);
    return true;
  }

  function push(id, onBack) {
    if (!started) init();
    for (var i = 0; i < overlays.length; i++) if (overlays[i].id === id) return function () { pop(id); };
    overlays.push({ id: id, onBack: onBack });
    history.pushState(state('overlay', { overlay: id }), '');
    notify();
    return function () { pop(id); };
  }

  function pop(id) {                                    // closed by the app itself (X, backdrop, Esc, action)
    var idx = -1;
    for (var i = overlays.length - 1; i >= 0; i--) if (overlays[i].id === id) { idx = i; break; }
    if (idx === -1) return;
    overlays.splice(idx, 1);
    skipPops++;
    history.back();                                     // drop the history entry that belonged to the overlay
    notify();
  }

  function navigate(route, data) {
    if (!started) init();
    current = { route: route, data: data || null };
    depth++;
    history.pushState(state('screen'), '');
    emit('forward');
    notify();
  }

  function replace(route, data) {
    if (!started) init();
    current = { route: route, data: data || null };
    history.replaceState(state(depth ? 'screen' : 'root'), '');
    emit('replace');
  }

  global.BackStack = {
    init: init, push: push, pop: pop, navigate: navigate, replace: replace,
    onRoute: function (fn) { routeFn = fn; },
    root: function (r) { rootRoute = r; current.route = r; },
    exit: function (fn) { exitFn = fn; },
    onExitHint: function (fn) { hintFn = fn; },
    canGoBack: function () { return overlays.length > 0 || depth > 0; },
    onChange: function (fn) { changeFns.push(fn); },
    get depth() { return depth; },
    get route() { return current.route; }
  };
})(window);

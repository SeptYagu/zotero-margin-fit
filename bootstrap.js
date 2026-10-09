/* global Zotero, Services, ChromeUtils */
"use strict";
var marginfit;
function startup(data) {
  const scope = {};
  Services.scriptloader.loadSubScript(data.rootURI + "src/core.js",scope);
  Services.scriptloader.loadSubScript(data.rootURI + "src/persistent-cache.js",scope);
  Services.scriptloader.loadSubScript(data.rootURI + "src/runtime.js",scope);
  const timers = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
  marginfit = new scope.MarginFitRuntime.Plugin({ Zotero,Services,timers,cacheModule:scope.MarginFitPersistentCache });
  // Diagnostics used by the disposable-profile regression runner; removed on shutdown.
  Zotero.MarginFit = marginfit;
  marginfit.start();
}
function shutdown() {
  marginfit?.stop();
  if (Zotero.MarginFit === marginfit) delete Zotero.MarginFit;
  marginfit = null;
}
function install() {}
function uninstall() {}

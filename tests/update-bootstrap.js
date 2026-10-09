/* Tests the public feed through Zotero's native updater in a disposable profile only. */
const checks = [];
const ID = 'marginfit@septyagu.local';
const FEED = 'https://raw.githubusercontent.com/SeptYagu/zotero-margin-fit/main/updates.json';
const OLD_URL = 'https://github.com/SeptYagu/zotero-margin-fit/releases/download/v0.1.1/zotero-margin-fit-0.1.1.xpi';
const OLD_HASH = 'sha256:92c95bbdecc610220059a6a820b800f71478fe83185137b69ffde383437cb5bb';
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
function startup() {
  if (!Services.prefs.getBoolPref('marginfit.integrationProfile',false)) return;
  Zotero.uiReadyPromise.then(run).catch(error=>finish({passed:false,error:String(error)}));
}
function check(condition,message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
async function until(fn) {
  for (let i=0;i<200;i++) { if (await fn()) return; await sleep(100); }
  throw new Error('Timeout waiting for updated plugin');
}
async function finish(result) {
  await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),
    {version:Zotero.version,checks,measurements:{},...result});
  Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
}
async function run() {
  try {
    await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
    const {AddonManager,AddonManagerPrivate}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
    const expected=Services.prefs.getStringPref('marginfit.integrationExpectedVersion');
    const oldInstall=await AddonManager.getInstallForURL(OLD_URL,{hash:OLD_HASH});
    await oldInstall.install();
    let addon=await AddonManager.getAddonByID(ID);
    check(addon?.isActive && addon.version==='0.1.1','Published 0.1.1 installs with its SHA-256 hash');
    Services.prefs.setBoolPref('extensions.marginfit.enabled',false);
    Services.prefs.setStringPref('extensions.marginfit.mode','height');
    const update=await new Promise((resolve,reject)=>{
      let available;
      addon.findUpdates({
        onUpdateAvailable(_addon,install) { available=install; },
        onUpdateFinished(_addon,status) {
          if (status || !available) reject(new Error('Native update check returned '+status+' without an update'));
          else resolve(available);
        }
      },AddonManager.UPDATE_WHEN_USER_REQUESTED);
    });
    check(update.version===expected,'Native Zotero update check discovers '+expected+' from the installed update URL');
    const expectedURL=`https://github.com/SeptYagu/zotero-margin-fit/releases/download/v${expected}/zotero-margin-fit-${expected}.xpi`;
    check(update.sourceURI.spec===expectedURL,'Native updater selects the published release asset');
    // Exercise the background installer too; do not call install() on the discovered update.
    addon.applyBackgroundUpdates=AddonManager.AUTOUPDATE_ENABLE;
    Services.prefs.setBoolPref('extensions.update.enabled',true);
    Services.prefs.setBoolPref('extensions.update.autoUpdateDefault',true);
    check(AddonManager.shouldAutoUpdate(addon),'Installed plugin permits native background auto-updates');
    await AddonManagerPrivate.backgroundUpdateCheck();
    await until(async()=> (await AddonManager.getAddonByID(ID))?.version===expected);
    addon=await AddonManager.getAddonByID(ID);
    check(addon.isActive && addon.isCompatible,'Native background updater downloads, verifies and activates '+expected+' without manual install');
    check(addon.description.startsWith('Fit PDF content') && addon.description.includes('自动识别 PDF 白边'),
      'Updated plugin description keeps English before Chinese');
    check(!Services.prefs.getBoolPref('extensions.marginfit.enabled') &&
      Services.prefs.getStringPref('extensions.marginfit.mode')==='height','Native update preserves detection and direction preferences');
    const item=await Zotero.Attachments.importFromFile({file:PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'clean-scan.pdf')});
    const reader=await Zotero.Reader.open(item.id);
    await until(()=>reader._iframeWindow?.document.querySelectorAll('[data-marginfit]').length===2);
    const doc=reader._iframeWindow.document;
    check(doc.querySelector('[data-marginfit="height"]').title==='Fit Height / 适合高度',
      'Updated runtime attaches the English-first height button');
    const toggle=doc.querySelector('[data-marginfit="detect"]');
    check(toggle.title==='Detect Margins: Off / 识别边界：关闭' && toggle.getAttribute('aria-pressed')==='false',
      'Updated runtime preserves OFF state and displays English before Chinese');
    await addon.uninstall();
    await finish({passed:true,fromVersion:'0.1.1',toVersion:expected,backgroundAutoUpdate:true,feed:FEED,download:expectedURL});
  } catch (error) { await finish({passed:false,error:String(error),stack:error.stack}); }
}

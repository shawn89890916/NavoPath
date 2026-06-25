const { app, BrowserWindow, ipcMain, safeStorage, dialog, shell, Tray, Menu, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
let _crypto; // lazy: only when uid() is first called
function getCrypto() { if (!_crypto) _crypto = require("node:crypto"); return _crypto; }

// Lazy-loaded: electron-updater is not needed until autoUpdater is configured
let _autoUpdaterModule;
let _autoUpdater;
function getAutoUpdaterModule() {
  if (!_autoUpdaterModule) _autoUpdaterModule = require("electron-updater");
  return _autoUpdaterModule;
}
function getAutoUpdater() {
  if (_autoUpdater) return _autoUpdater;
  const updaterModule = getAutoUpdaterModule();
  const resolvedUpdater = updaterModule?.autoUpdater
    ?? updaterModule?.default?.autoUpdater
    ?? updaterModule?.default
    ?? updaterModule;
  if (!resolvedUpdater || typeof resolvedUpdater.on !== "function") {
    throw new TypeError("electron-updater autoUpdater instance is unavailable");
  }
  _autoUpdater = resolvedUpdater;
  return _autoUpdater;
}

app.setName("NavoPath");

const DEFAULT_MODEL = "deepseek-v4-flash";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
let manualUpdateRequested = false;
let updateState = {
  status: app.isPackaged ? "idle" : "unsupported",
  currentVersion: app.getVersion(),
  availableVersion: "",
  progress: 0,
  message: app.isPackaged ? "" : "Update checks are available in the installed desktop app."
};

function publishUpdateState(patch) {
  updateState = { ...updateState, ...patch, currentVersion: app.getVersion() };
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send("updater:state", updateState);
  return updateState;
}

async function checkForDesktopUpdate(manual = false) {
  const autoUpdater = getAutoUpdater();
  if (!app.isPackaged) return publishUpdateState({ status: "unsupported" });
  if (["checking", "downloading"].includes(updateState.status)) return updateState;
  if (manual && updateState.status === "available") {
    manualUpdateRequested = false;
    publishUpdateState({ status: "downloading", progress: 0 });
    await autoUpdater.downloadUpdate();
    return updateState;
  }
  manualUpdateRequested = manual;
  publishUpdateState({ status: "checking", progress: 0, message: "" });
  await autoUpdater.checkForUpdates();
  return updateState;
}

function configureAutoUpdater() {
  const autoUpdater = getAutoUpdater();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", async (info) => {
    publishUpdateState({ status: "available", availableVersion: info.version, progress: 0 });
    if (!manualUpdateRequested) return;
    manualUpdateRequested = false;
    publishUpdateState({ status: "downloading", progress: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      publishUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  });
  autoUpdater.on("update-not-available", () => {
    manualUpdateRequested = false;
    publishUpdateState({ status: "current", availableVersion: "", progress: 0 });
  });
  autoUpdater.on("download-progress", (progress) => {
    publishUpdateState({ status: "downloading", progress: Math.round(progress.percent || 0) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateState({ status: "downloaded", availableVersion: info.version, progress: 100 });
  });
  autoUpdater.on("error", (error) => {
    manualUpdateRequested = false;
    publishUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
  });

  if (!app.isPackaged) return;
  const initialTimer = setTimeout(() => void checkForDesktopUpdate(false).catch((error) => publishUpdateState({ status: "error", message: String(error) })), 30_000);
  const interval = setInterval(() => void checkForDesktopUpdate(false).catch((error) => publishUpdateState({ status: "error", message: String(error) })), UPDATE_INTERVAL_MS);
  initialTimer.unref?.();
  interval.unref?.();
}

function todayIso() {
  return localDateIso(new Date());
}

function localDateIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${getCrypto().randomBytes(3).toString("hex")}`;
}

function makeTask(title, dueDate, category, priority = "medium", notes = "", goalId = "goal_admission") {
  return {
    id: uid("task"),
    title,
    dueDate,
    category,
    priority,
    notes,
    goalId,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function makeEvent(title, date, category, details = "") {
  return {
    id: uid("event"),
    title,
    date,
    category,
    details,
    imported: true,
    createdAt: new Date().toISOString()
  };
}

let _smartNoteTemplates = null;
function getSmartNoteTemplates() {
  if (!_smartNoteTemplates) {
    _smartNoteTemplates = Object.freeze({
  "纭鑻卞浗 UCAS 宸ョ▼涓撲笟缁勫悎": "鐩爣锛氬湪 2026-06-15 鍓嶉攣瀹?5 涓?UCAS 蹇楁効鐨勪笓涓氬悕绉般€佽绋嬩唬鐮佸拰鏇夸唬椤哄簭锛岄伩鍏嶅悗缁?PS 涓庤€冭瘯鍑嗗鏂瑰悜鍙嶅鎽囨憜銆俓n琛￠噺锛氫骇鍑?1 寮犲姣旇〃锛岃嚦灏戝寘鍚墤妗ャ€両mperial銆乁CL銆並CL 涓?1 涓浛浠ｅ伐绋嬮」鐩紱姣忎釜椤圭洰鍐欐竻鍏ュ瑕佹眰銆丒SAT/TARA 瑕佹眰銆佹牳蹇冭绋嬪尮閰嶅害鍜岄闄╃瓑绾с€俓n琛屽姩锛氶€愭牎鎵撳紑瀹樼綉璇剧▼椤碉紝鏍稿 2027 Entry 瑕佹眰锛涙妸涓嶇‘瀹氶」鏍囩孩锛涙渶鍚庢寜鈥滃啿鍒恒€佸尮閰嶃€佷繚搴曗€濈粰鍑烘帓搴忋€俓n璧勬枡锛歎CAS Search銆佸悇澶у Engineering/Robotics/AI/Mechanical/Aerospace 瀹樼綉椤甸潰銆佸崌瀛︽寚瀵兼姤鍛娿€俓n瀹屾垚鏍囧噯锛氬姣旇〃娌℃湁绌洪」锛屽苟鑳界敤 3 鍙ヨ瘽瑙ｉ噴涓轰粈涔堣繖 5 涓笓涓氱粍鍚堥€傚悎宸ョ▼/鏈哄櫒浜?鑸┖鑸ぉ鏂瑰悜銆?,
  "鍚姩 ESAT/TARA 璁粌璁″垝": "鐩爣锛氬湪 2026-06-20 鍓嶅缓绔?ESAT Maths 1銆丮aths 2銆丳hysics 鍜?TARA 鐨勫浐瀹氳缁冪郴缁熴€俓n琛￠噺锛氬缓濂?1 涓敊棰樿〃銆? 涓垎鏁拌褰曡〃鍜?1 涓瘡鍛ㄨ缁冭〃锛涙瘡涓鐩嚦灏戝畬鎴?1 娆″熀绾挎祴璇曟垨鏍烽璁粌銆俓n琛屽姩锛氫笅杞藉畼鏂规牱棰樺拰 guide锛涙寜 40 鍒嗛挓闄愭椂鍋?ESAT module锛汿ARA 鍗曠嫭鏁寸悊棰樺瀷銆佹椂闂撮檺鍒跺拰寮辩偣锛涙瘡娆¤缁冨悗璁板綍閿欒鍘熷洜銆俓n璧勬枡锛歎AT ESAT 椤甸潰 https://esat-tmua.ac.uk/about-the-tests/esat-test/锛沀AT 澶囪€冩潗鏂?https://esat-tmua.ac.uk/esat-preparation-materials/锛汸earson UAT 椤甸潰 https://www.pearsonvue.com/us/en/uatuk.html銆俓n瀹屾垚鏍囧噯锛氭墦寮€浠诲姟鏂囦欢澶规椂鑳界湅鍒拌祫鏂欏簱銆侀敊棰樿〃銆佸垎鏁拌〃鍜屼笅涓€鍛ㄨ缁冨畨鎺掞紝涓嶉渶瑕佷复鏃舵壘鏉愭枡銆?,
  "鏁寸悊椤圭洰璇佹嵁鏂囦欢澶?: "鐩爣锛氬湪 2026-06-25 鍓嶆妸 ISSDC銆?D 鎵撳嵃銆佽鏂囥€佺伀绠€乀I-BASIC 绛夐」鐩暣鐞嗘垚鍙敤浜庢枃涔︺€佹椿鍔ㄨ〃鍜屾帹鑽愪俊鐨勮瘉鎹簱銆俓n琛￠噺锛氭瘡涓」鐩嚦灏戞湁 1 涓」鐩畝浠嬨€?-5 寮犲浘鐗?鎴浘銆佸叧閿垚鏋滄暟鎹€佹湰浜鸿础鐚鏄庡拰鍙紩鐢ㄩ摼鎺ユ垨鏂囦欢銆俓n琛屽姩锛氭寜椤圭洰寤烘枃浠跺す锛涙妸鍘熷鏂囦欢銆佺収鐗囥€佷唬鐮併€佽鏂囥€佽瘉涔︽斁鍏ュ搴旂洰褰曪紱鍐?100-150 瀛楄嫳鏂囬」鐩憳瑕侊紱鏍囨敞鏈€鑳戒綋鐜板伐绋嬭兘鍔涚殑璇佹嵁銆俓n璧勬枡锛氱數鑴戞湰鍦伴」鐩枃浠躲€佺収鐗囥€佽瘉涔︺€佽鏂囩銆丟itHub/缃戠洏閾炬帴銆佸崌瀛︽寚瀵兼姤鍛娿€俓n瀹屾垚鏍囧噯锛氫换鎰忔墦寮€涓€涓」鐩枃浠跺す锛岄兘鑳界洿鎺ユ壘鍒扳€滄垜鍋氫簡浠€涔堛€佺粨鏋滄槸浠€涔堛€佽兘璇佹槑浠€涔堚€濈殑鏉愭枡銆?,
  "瀹屾垚 Common App 娲诲姩琛ㄥ垵绋?: "鐩爣锛氬湪 2026-07-20 鍓嶅畬鎴?Common App 10 椤规椿鍔ㄧ殑鑻辨枃鍒濈锛屽舰鎴愭棭鐢冲彲缁х画鎵撶（鐨勭増鏈€俓n琛￠噺锛?0 椤规椿鍔ㄦ寜褰卞搷鍔涙帓搴忥紱姣忛」鍖呭惈鑱屼綅/缁勭粐銆佹椂闂存姇鍏ャ€佽嫳鏂?150 瀛楃鎻忚堪鍜屽搴旇瘉鎹€俓n琛屽姩锛氬厛鍒楀叏閮ㄦ椿鍔紝鍐嶆寜宸ョ▼鐩稿叧鎬с€佸奖鍝嶅姏銆佹寔缁椂闂寸瓫閫夛紱鎶婂姩璇嶆敼鎴愬叿浣撹础鐚紝濡?designed銆乥uilt銆乼ested銆乴ed銆乸ublished锛涘垹闄ゆ硾娉涙弿杩般€俓n璧勬枡锛欳ommon App 娲诲姩鏍忔牸寮忋€侀」鐩瘉鎹枃浠跺す銆佺珵璧?绀惧洟/鐮旂┒璁板綍銆俓n瀹屾垚鏍囧噯锛氭椿鍔ㄨ〃璇昏捣鏉ヨ兘浣撶幇宸ョ▼涓荤嚎锛屽苟涓旀瘡椤归兘鑳借璇佹嵁鏂囦欢澶规敮鎸併€?,
  "鑻卞浗 PS 绗竴鐗?: "鐩爣锛氬湪 2026-08-20 鍓嶅畬鎴愯嫳鍥?Personal Statement 绗竴鐗堬紝涓荤嚎鑱氱劍宸ョ▼鎬濈淮鍜岄」鐩凯浠ｈ兘鍔涖€俓n琛￠噺锛氫骇鍑?1 绡囧畬鏁磋嫳鏂?PS锛涜鐩栧鏈叴瓒ｃ€侀」鐩粡鍘嗐€佹暟瀛?鐗╃悊鑳藉姏銆佸伐绋嬪弽鎬濆拰鐩爣涓撲笟鍖归厤锛涘瓧鏁扮鍚?UCAS 褰撳墠闄愬埗銆俓n琛屽姩锛氬厛鍐欎腑鏂囩礌鏉愭彁绾诧紝鍐嶈浆鎴愯嫳鏂囨钀斤紱姣忔鍙繚鐣欎竴涓牳蹇冭鐐癸紱鐢ㄩ」鐩瘉鎹敮鎾戔€滃缓妯?鍘熷瀷-娴嬭瘯-杩唬鈥濈殑涓荤嚎銆俓n璧勬枡锛歎CAS PS 鎸囧崡銆佺洰鏍囦笓涓氳绋嬮〉銆侀」鐩瘉鎹枃浠跺す銆佸崌瀛︽寚瀵兼姤鍛娿€俓n瀹屾垚鏍囧噯锛氱涓€鐗堜笉鏄礌鏉愬爢鐮岋紝鑰屾槸鑳芥竻妤氬洖绛斺€滀负浠€涔堝伐绋嬨€佷负浠€涔堣繖浜涚粡鍘嗚瘉鏄庨€傚悎宸ョ▼鈥濄€?,
  "鎺ㄨ崘淇℃潗鏂欏寘鍙戠粰鑰佸笀": "鐩爣锛氬湪 2026-08-25 鍓嶇粰鎺ㄨ崘鑰佸笀鍙戦€佸畬鏁存潗鏂欏寘锛岄檷浣庤€佸笀鍐欎俊鏃朵俊鎭笉鍏ㄧ殑椋庨櫓銆俓n琛￠噺锛氭潗鏂欏寘鍖呭惈鐩爣涓撲笟銆佺敵璇峰鏍°€佽绋嬭〃鐜般€侀」鐩础鐚€佸笇鏈涘己璋冪殑 3-5 涓兘鍔涚偣銆佹埅姝㈡棩鏈熷拰鑱旂郴鏂瑰紡銆俓n琛屽姩锛氭暣鐞?1 椤?brag sheet锛涢檮鎴愮哗/璇剧▼琛ㄧ幇浜偣锛涘垪鍑烘渶甯屾湜鑰佸笀鎻愬埌鐨勫叿浣撹鍫傛垨椤圭洰渚嬪瓙锛涘彂鍑哄悗纭鑰佸笀鏀跺埌銆俓n璧勬枡锛氭垚缁╄褰曘€佽绋嬩綔涓氥€侀」鐩瘉鎹枃浠跺す銆佺敵璇峰鏍℃竻鍗曘€俓n瀹屾垚鏍囧噯锛氳€佸笀涓嶇敤鍐嶈拷闂熀纭€淇℃伅锛屽氨鑳藉熀浜庢潗鏂欏啓鍑哄叿浣撴帹鑽愬唴瀹广€?,
  "ESAT/TARA 鍐插埡澶嶇洏": "鐩爣锛氬湪 2026-09-20 鍓嶅畬鎴?ESAT/TARA 鍐插埡闃舵澶嶇洏锛屾槑纭渶鍚庝笁鍛ㄧ殑鎻愬垎浼樺厛绾с€俓n琛￠噺锛氳嚦灏戝畬鎴?2 濂楅檺鏃剁粍鍚堣缁冿紱缁熻 Maths 1銆丮aths 2銆丳hysics 鍜?TARA 鐨勬纭巼銆佽€楁椂銆侀敊鍥?Top 5銆俓n琛屽姩锛氭寜鑰冭瘯鏃堕棿闄愬埗鍋氶锛涘鐩樻椂鎶婇敊璇垎涓虹煡璇嗘紡娲炪€佽绠楀け璇€佽棰樿鍒ゃ€佹椂闂寸瓥鐣ワ紱涓烘瘡绫婚敊璇畨鎺掕ˉ鏁戝姩浣溿€俓n璧勬枡锛歎AT/Pearson 瀹樻柟鏍烽銆侀敊棰樿〃銆佸垎鏁拌褰曡〃銆乀ARA 缁冧範鏉愭枡銆俓n瀹屾垚鏍囧噯锛氳緭鍑?1 椤靛啿鍒烘竻鍗曪紝鍐欐竻姣忓ぉ缁冧粈涔堛€佷负浠€涔堢粌銆佸畬鎴愬悗濡備綍妫€鏌ャ€?,
  "缇庡浗 ED/EA 鏂囦功瀹氱": "鐩爣锛氬湪 2026-10-25 鍓嶅畬鎴愮編鍥?ED/EA 涓绘枃涔︺€侀檮鏂囦功鍜屾椿鍔ㄨ〃鏈€缁堟鏌ャ€俓n琛￠噺锛氭墍鏈夋棭鐢冲鏍℃枃涔﹂兘鏈夋渶缁堢増锛涙瘡绡囧畬鎴愭嫾鍐欐鏌ャ€佸鏍″尮閰嶆鏌ャ€佷簨瀹炴牳瀵瑰拰绗笁鏂瑰弽棣堜慨鏀广€俓n琛屽姩锛氶€愭牎寤虹珛鎻愪氦娓呭崟锛涙鏌ユ枃涔︽槸鍚﹀洖绛旈鐩€佹槸鍚︽湁鍏蜂綋渚嬪瓙銆佹槸鍚﹂噸澶嶆椿鍔ㄨ〃锛涙渶鍚庣粺涓€鏍稿 Common App 淇℃伅銆俓n璧勬枡锛欳ommon App銆佸悇鏍＄敵璇?portal銆佹枃涔﹁崏绋裤€佹椿鍔ㄨ〃銆佹帹鑽愪俊鐘舵€併€俓n瀹屾垚鏍囧噯锛氭瘡鎵€鏃╃敵瀛︽牎閮借揪鍒扳€滀粖澶╂彁浜や篃涓嶄細閬楁紡鏉愭枡鈥濈殑鐘舵€併€?,
  "缇庡浗 RD 娓呭崟鏍″噯": "鐩爣锛氬湪 2026-12-15 鍓嶆牴鎹?ED/EA 缁撴灉銆侀绠楀拰涓撲笟鍋忓ソ鏍″噯 RD 瀛︽牎娓呭崟銆俓n琛￠噺锛氬舰鎴?1 浠?RD 娓呭崟锛屾寜鍐插埡銆佸尮閰嶃€佷繚搴曞垎绫伙紱姣忔牎鍖呭惈鎴鏃ユ湡銆佽ˉ鍏呮枃涔︽暟閲忋€佷笓涓氬尮閰嶃€佽垂鐢?濂栧閲戜俊鎭€俓n琛屽姩锛氬厛鏇存柊鏃╃敵缁撴灉鍜屽搴绠楃害鏉燂紱鍒犻櫎鏄庢樉涓嶅尮閰嶅鏍★紱琛ュ叆宸ョ▼/鏈哄櫒浜?AI 鏂瑰悜鏇村己鎴栭闄╂洿鍚堢悊鐨勯€夋嫨銆俓n璧勬枡锛欳ommon App銆丆ollege Board/瀛︽牎瀹樼綉璐圭敤椤点€佷笓涓氳绋嬮〉銆佹棭鐢崇粨鏋溿€俓n瀹屾垚鏍囧噯锛歊D 娓呭崟鏁伴噺鍙墽琛岋紝涓旀瘡鎵€瀛︽牎閮芥湁鏄庣‘鐢宠鐞嗙敱銆?,
  "ESAT W1D1锛氬缓绔嬭祫鏂欏簱 + Maths 1 璇婃柇": "鐩爣锛氬湪 2026-06-01 瀹屾垚 ESAT 璧勬枡搴撴惌寤猴紝骞舵嬁鍒?Maths 1 绗竴娆″熀绾垮垎鏁般€俓n琛￠噺锛氬畬鎴?Pearson ESAT Mathematics 1 鏍烽 40 鍒嗛挓闄愭椂璁粌锛涜褰曟€婚鏁般€佹纭暟銆佺┖棰樻暟銆佽秴鏃堕鏁板拰閿欏洜銆俓n琛屽姩锛氬厛淇濆瓨 UAT銆丳earson 璧勬枡閾炬帴锛涜缃?40 鍒嗛挓璁℃椂锛涘仛瀹岀珛鍗虫妸閿欓褰曞叆琛ㄦ牸锛屾爣娉ㄧ煡璇嗙偣鍜岄敊璇師鍥犮€俓n璧勬枡锛歎AT ESAT https://esat-tmua.ac.uk/about-the-tests/esat-test/锛沀AT 澶囪€冩潗鏂?https://esat-tmua.ac.uk/esat-preparation-materials/锛汸earson https://www.pearsonvue.com/us/en/uatuk.html銆俓n瀹屾垚鏍囧噯锛氶敊棰樿〃閲岃嚦灏戞湁棰樺彿銆佺煡璇嗙偣銆侀敊璇師鍥犮€佹纭€濊矾鍜屼笅娆″涔犳棩鏈熴€?,
  "ESAT W1D2锛歁aths 1 閿欓澶嶇洏 + 鏃犺绠楀櫒閫熷害": "鐩爣锛氬湪 2026-06-02 澶嶇洏 W1D1 Maths 1 閿欓锛屽苟鎻愰珮鏃犺绠楀櫒鐭閫熷害銆俓n琛￠噺锛氬畬鎴?W1D1 鎵€鏈夐敊棰樺鐩橈紱棰濆瀹屾垚 20 閬撶煭棰橈紝姣忛鎺у埗鍦?90 绉掑唴锛涜褰曟纭巼鍜岃秴鏃舵暟閲忋€俓n琛屽姩锛氬厛閲嶅仛閿欓锛屼笉鐪嬬瓟妗堝啓鍑烘纭В娉曪紱鍐嶅仛 20 閬撶煭棰橈紱鎶婅秴杩?90 绉掓垨璁＄畻鍗￠】鐨勯鍒楀叆閫熷害涓撻」銆俓n璧勬枡锛歎AT Mathematics 1 guide https://esat-tmua.ac.uk/esat-preparation-materials/锛沋ouTube ESAT Maths 1 walkthrough锛汿LMaths https://www.youtube.com/@TLMaths銆俓n瀹屾垚鏍囧噯锛氳兘璇存竻 Maths 1 褰撳墠鏈€寮辩殑 3 涓鍨嬶紝浠ュ強涓嬩竴娆¤缁冭浼樺厛琛ュ摢涓€涓€?,
  "ESAT W1D3锛歁aths 2 鍩虹嚎娴嬭瘯": "鐩爣锛氬湪 2026-06-03 瀹屾垚 Maths 2 绗竴娆?40 鍒嗛挓鍩虹嚎娴嬭瘯锛屾壘鍑洪珮闃舵暟瀛﹁杽寮辩偣銆俓n琛￠噺锛氳褰曟纭暟銆侀敊璇暟銆佺┖棰樻暟鍜?Top 3 寮辩偣锛涙瘡涓急鐐硅嚦灏戝搴?2 閬撳叿浣撻鐩€俓n琛屽姩锛氭寜鑰冭瘯鏃堕檺瀹屾垚 Pearson Maths 2 sample/specimen锛涘仛瀹屽悗鍏堝垎绫婚敊鍥狅紝鍐嶅洖鐪?guide 瀵瑰簲鐭ヨ瘑鐐广€俓n璧勬枡锛歅earson UAT https://www.pearsonvue.com/us/en/uatuk.html锛沀AT Mathematics 2 guide https://esat-tmua.ac.uk/esat-preparation-materials/锛沋ouTube Maths 2 walkthrough銆俓n瀹屾垚鏍囧噯锛氬垎鏁拌〃鍜岄敊棰樿〃宸叉洿鏂帮紝骞跺啓鍑?Maths 2 涓嬩竴鍛ㄤ紭鍏堣缁?topic銆?,
  "ESAT W1D4锛歅hysics 鍩虹嚎娴嬭瘯": "鐩爣锛氬湪 2026-06-04 瀹屾垚 Physics 40 鍒嗛挓鍩虹嚎娴嬭瘯锛屽缓绔嬬墿鐞嗛骞插埌鍏紡/鎬濊矾鐨勬槧灏勮〃銆俓n琛￠噺锛氳褰曟纭巼鍜岄敊鍥狅紱鏁寸悊鑷冲皯 5 鏉♀€滈骞蹭俊鍙?-> 鍏紡/妯″瀷/瑙ｉ鍏ュ彛鈥濄€俓n琛屽姩锛氶檺鏃跺畬鎴?Physics sample/specimen锛涘鐩樻椂涓嶅彧鍐欑瓟妗堬紝鑰屾槸鍐欓鐩浣曟彁绀轰娇鐢ㄥ摢涓ā鍨嬨€俓n璧勬枡锛歅earson UAT https://www.pearsonvue.com/us/en/uatuk.html锛沀AT Physics guide https://esat-tmua.ac.uk/esat-preparation-materials/锛汸hysics Online https://www.youtube.com/@PhysicsOnline銆俓n瀹屾垚鏍囧噯锛氱墿鐞嗛敊棰樿〃鑷冲皯瑕嗙洊鍏紡閫夋嫨銆佸崟浣嶆鏌ャ€佸浘鍍?鎯呭鐞嗚В涓夌被闂銆?,
  "ESAT W1D5锛欵NGAA/NSAA 椋庢牸鍏ラ棬 + 涓夌閿欓鏁寸悊": "鐩爣锛氬湪 2026-06-05 鐢?ENGAA/NSAA archive 琛ュ厖 ESAT 鐩歌繎棰樺瀷锛屽苟鏁寸悊鏈懆涓夌寮辩偣銆俓n琛￠噺锛氬畬鎴?2022 鎴?2023 Section 1 涓浉鍏?Maths/Physics 棰橈紱鏁寸悊 1-10 鐨勫急鐐规竻鍗曪紝鎸夊奖鍝嶅垎鎺掑簭銆俓n琛屽姩锛氶€変笌 ESAT Maths/Physics 鐩歌繎鐨勯鍋氶檺鏃剁粌涔狅紱鎶婃湰鍛?Maths 1銆丮aths 2銆丳hysics 閿欓鍚堝苟褰掔被銆俓n璧勬枡锛歎AT ENGAA/NSAA archive https://esat-tmua.ac.uk/esat-preparation-materials/锛汦NGAA/NSAA walkthrough 鎼滅储缁撴灉銆俓n瀹屾垚鏍囧噯锛氬急鐐规竻鍗曟瘡涓€椤归兘鏈夊搴旈鍙枫€侀敊璇師鍥犲拰涓嬩竴姝ョ粌涔犳柟寮忋€?,
  "ESAT W1D6锛氫袱绉戣繛缁?+ 鏃堕棿绛栫暐": "鐩爣锛氬湪 2026-06-06 瀹屾垚涓や釜 ESAT module 杩炵画闄愭椂璁粌锛屾祴璇曚綋鍔涘拰鏃堕棿绛栫暐銆俓n琛￠噺锛氳繛缁畬鎴愪袱涓?40 鍒嗛挓 module锛涜褰曟瘡涓?module 鐨勬纭巼銆佽烦棰樻暟閲忋€乫lag 鏁伴噺鍜屾渶鍚?5 鍒嗛挓澶勭悊鎯呭喌銆俓n琛屽姩锛氭ā鎷熻€冭瘯鑺傚锛屼腑闂村彧鐭紤鎭紱璁粌 60-90 绉掑垽鏂槸鍚﹁烦棰橈紱鏈€鍚?5 鍒嗛挓妫€鏌ユ湭绛旈骞跺畬鎴愬叏濉€俓n璧勬枡锛歅earson sample/specimen https://www.pearsonvue.com/us/en/uatuk.html锛沀AT 澶囪€冩潗鏂?https://esat-tmua.ac.uk/esat-preparation-materials/銆俓n瀹屾垚鏍囧噯锛氬啓鍑?3 鏉′釜浜烘椂闂寸瓥鐣ワ紝渚嬪鍝簺棰樺厛璺炽€佷綍鏃跺洖鐪嬨€佹渶鍚?5 鍒嗛挓鎬庝箞鍒嗛厤銆?,
  "ESAT W1D7锛氬懆澶嶇洏 + 涓嬪懆璁″垝": "鐩爣锛氬湪 2026-06-07 瀹屾垚 ESAT 绗竴鍛ㄥ鐩橈紝骞跺埗瀹氱浜屽懆璁粌閲嶇偣銆俓n琛￠噺锛氭眹鎬?Maths 1銆丮aths 2銆丳hysics 鍘熷鍒嗭紱姣忕閫夊嚭 2 涓笅鍛ㄤ紭鍏?topic锛涘啓 1 椤靛懆鎶ャ€俓n琛屽姩锛氱湅鍒嗘暟瓒嬪娍鍜岄敊鍥犲垎绫伙紱涓嶈鍙湅姝ｇ‘鐜囷紝瑕佸垽鏂槸鐭ヨ瘑闂銆侀€熷害闂杩樻槸绛栫暐闂锛涙妸涓嬪懆浠诲姟鎷嗗埌姣忓ぉ銆俓n璧勬枡锛歅raneel Physics ESAT Hub https://praneelphysics.com/esat/hub锛沀AT 澶囪€冩潗鏂欙紱YouTube ESAT Maths/Physics walkthrough銆俓n瀹屾垚鏍囧噯锛氬懆鎶ュ寘鍚湰鍛ㄦ暟鎹€佷富瑕侀棶棰樸€佷笅鍛ㄦ瘡鏃ュ畨鎺掑拰妫€鏌ユ爣鍑嗐€?
    });
  }
  return _smartNoteTemplates;
}

function smartNoteForTask(task) {
  return task.notes || "";
}

function normalizePlannerData(data) {
  if (!data || !Array.isArray(data.tasks)) return data;
  return {
    ...data,
    importedSeedVersion: data.importedSeedVersion === "admission-2027-v1" ? "admission-2027-v2-smart-notes" : data.importedSeedVersion,
    projects: Array.isArray(data.projects)
      ? data.projects.map((project) => ({
          ...project,
          color: project.color || "#C69CF9",
          importance: project.importance || "high",
          urgency: project.urgency || "low"
        }))
      : [],
    longTasks: Array.isArray(data.longTasks) ? data.longTasks : [],
    aiMemories: Array.isArray(data.aiMemories) ? data.aiMemories : [],
    drafts: Array.isArray(data.drafts)
      ? data.drafts
          .filter((draft) => draft && draft.title && !(typeof draft.details === "string" && draft.details.startsWith("[棰勮]")))
          .slice(-10)
      : [],
    events: Array.isArray(data.events)
      ? data.events.map((event) => ({
          ...event,
          date: event.date || event.startDate || todayIso(),
          startDate: event.startDate || event.date || todayIso(),
          endDate: event.endDate || event.startDate || event.date || todayIso(),
          startTime: event.startTime || "",
          endTime: event.endTime || ""
        }))
      : [],
    taskLayouts: data.taskLayouts && typeof data.taskLayouts === "object" ? data.taskLayouts : {},
    tasks: data.tasks.map((task) => ({
      ...task,
      subtasks: (task.subtasks || []).map((subtask, index) => ({
        ...subtask,
        id: subtask.id || uid("sub"),
        title: subtask.title || "",
        completed: typeof subtask.completed === "boolean" ? subtask.completed : Boolean(subtask.done),
        done: typeof subtask.done === "boolean" ? subtask.done : Boolean(subtask.completed),
        order: typeof subtask.order === "number" ? subtask.order : index,
        createdAt: subtask.createdAt || new Date().toISOString()
      })),
      notes: smartNoteForTask(task)
    }))
  };
}

function findGuidanceReport() {
  const names = ["闄堟絿鏉?2027Entry鑻辩編宸ョ▼鏂瑰悜鍗囧鎸囧鎶ュ憡.docx"];
  const roots = [
    process.cwd(),
    path.join(process.cwd(), "outputs"),
    path.join(process.cwd(), "..", "outputs"),
    path.join(process.cwd(), "..", "..", "outputs"),
    path.join(app.getAppPath(), "..", "outputs"),
    path.join(app.getAppPath(), "..", "..", "outputs"),
    "D:\\233cxy\\OneDrive\\鏂囨。\\鍗囧鎸囧\\outputs"
  ];
  for (const root of roots) {
    for (const name of names) {
      const candidate = path.resolve(root, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return "";
}

function seedData() {
  const reportPath = findGuidanceReport();
  const tasks = [
    makeTask("纭鑻卞浗 UCAS 宸ョ▼涓撲笟缁勫悎", "2026-06-15", "uk", "high", "鍓戞ˉ銆両mperial銆乁CL銆並CL 涓庢浛浠ｅ伐绋嬮」鐩€?),
    makeTask("鍚姩 ESAT/TARA 璁粌璁″垝", "2026-06-20", "exam", "high", "鏁板1銆佹暟瀛?銆佺墿鐞嗭紱鍗曠嫭鍑嗗 TARA銆?),
    makeTask("鏁寸悊椤圭洰璇佹嵁鏂囦欢澶?, "2026-06-25", "materials", "high", "ISSDC銆?D 鎵撳嵃銆佽鏂囥€佺伀绠€乀I-BASIC銆?),
    makeTask("瀹屾垚 Common App 娲诲姩琛ㄥ垵绋?, "2026-07-20", "us", "medium", "鎸夋椿鍔ㄥ奖鍝嶅姏鎺掑簭锛屽噯澶囪嫳鏂囨弿杩般€?),
    makeTask("鑻卞浗 PS 绗竴鐗?, "2026-08-20", "essay", "high", "鍥寸粫寤烘ā-鍘熷瀷-娴嬭瘯-杩唬涓荤嚎銆?),
    makeTask("鎺ㄨ崘淇℃潗鏂欏寘鍙戠粰鑰佸笀", "2026-08-25", "materials", "high", "璇剧▼琛ㄧ幇銆侀」鐩础鐚€佺洰鏍囦笓涓氥€佸笇鏈涘己璋冪殑鑳藉姏銆?),
    makeTask("ESAT/TARA 鍐插埡澶嶇洏", "2026-09-20", "exam", "high", "闄愭椂濂楅銆侀敊棰樺綊鍥犮€佽杽寮辨ā鍧椼€?),
    makeTask("缇庡浗 ED/EA 鏂囦功瀹氱", "2026-10-25", "us", "high", "鏃╃敵瀛︽牎闄勬枃涔﹀拰娲诲姩琛ㄦ鏌ャ€?),
    makeTask("缇庡浗 RD 娓呭崟鏍″噯", "2026-12-15", "us", "medium", "缁撳悎 ED/EA 缁撴灉銆侀绠楀拰涓撲笟鍋忓ソ銆?),
    makeTask("ESAT W1D1锛氬缓绔嬭祫鏂欏簱 + Maths 1 璇婃柇", "2026-06-01", "exam", "high", "UAT 瀹樻柟 ESAT 椤甸潰锛歨ttps://esat-tmua.ac.uk/about-the-tests/esat-test/锛沀AT 澶囪€冩潗鏂欙細https://esat-tmua.ac.uk/esat-preparation-materials/锛汸earson sample/specimen锛歨ttps://www.pearsonvue.com/us/en/uatuk.html銆備换鍔★細鍋?Pearson ESAT Mathematics 1锛岄檺鏃?40 鍒嗛挓锛屽缓绔嬮敊棰樿〃銆?),
    makeTask("ESAT W1D2锛歁aths 1 閿欓澶嶇洏 + 鏃犺绠楀櫒閫熷害", "2026-06-02", "exam", "high", "璧勬枡锛歎AT Mathematics 1 guide锛歨ttps://esat-tmua.ac.uk/esat-preparation-materials/锛沋ouTube锛歨ttps://www.youtube.com/results?search_query=ESAT+Maths+1+walkthrough锛汿LMaths锛歨ttps://www.youtube.com/@TLMaths銆備换鍔★細澶嶇洏 W1D1 閿欓锛屽仛 20 閬?90 绉掑唴鐭銆?),
    makeTask("ESAT W1D3锛歁aths 2 鍩虹嚎娴嬭瘯", "2026-06-03", "exam", "high", "璧勬枡锛歅earson ESAT Mathematics 2 sample/specimen锛歨ttps://www.pearsonvue.com/us/en/uatuk.html锛沀AT Mathematics 2 guide锛歨ttps://esat-tmua.ac.uk/esat-preparation-materials/锛沋ouTube锛歨ttps://www.youtube.com/results?search_query=ESAT+Maths+2+walkthrough銆備换鍔★細闄愭椂 40 鍒嗛挓鍋?Maths 2锛屾暣鐞?Top 3 寮辩偣銆?),
    makeTask("ESAT W1D4锛歅hysics 鍩虹嚎娴嬭瘯", "2026-06-04", "exam", "high", "璧勬枡锛歅earson ESAT Physics sample/specimen锛歨ttps://www.pearsonvue.com/us/en/uatuk.html锛沀AT Physics guide锛歨ttps://esat-tmua.ac.uk/esat-preparation-materials/锛汸hysics Online锛歨ttps://www.youtube.com/@PhysicsOnline锛沋ouTube锛歨ttps://www.youtube.com/results?search_query=ESAT+Physics+walkthrough銆備换鍔★細闄愭椂 40 鍒嗛挓鍋?Physics锛屽啓 5 鏉￠骞蹭俊鍙峰埌鍏紡/鎬濊矾銆?),
    makeTask("ESAT W1D5锛欵NGAA/NSAA 椋庢牸鍏ラ棬 + 涓夌閿欓鏁寸悊", "2026-06-05", "exam", "medium", "璧勬枡锛歎AT 瀹樻柟 ENGAA/NSAA archive锛歨ttps://esat-tmua.ac.uk/esat-preparation-materials/锛汦NGAA walkthrough锛歨ttps://www.youtube.com/results?search_query=ENGAA+Section+1+walkthrough锛汵SAA walkthrough锛歨ttps://www.youtube.com/results?search_query=NSAA+Section+1+walkthrough銆備换鍔★細閫?2022/2023 Section 1 鍋氱浉鍏?Maths/Physics 棰橈紝鏁寸悊鏈懆寮辩偣 1-10銆?),
    makeTask("ESAT W1D6锛氫袱绉戣繛缁?+ 鏃堕棿绛栫暐", "2026-06-06", "exam", "high", "璧勬枡锛歅earson sample/specimen锛歨ttps://www.pearsonvue.com/us/en/uatuk.html锛沀AT 澶囪€冩潗鏂欙細https://esat-tmua.ac.uk/esat-preparation-materials/銆備换鍔★細杩炵画鍋氫袱涓?40 鍒嗛挓 module锛岃缁?60-90 绉掕烦棰樸€乫lag 鍜屾渶鍚?5 鍒嗛挓鍏ㄥ～銆?),
    makeTask("ESAT W1D7锛氬懆澶嶇洏 + 涓嬪懆璁″垝", "2026-06-07", "exam", "high", "璧勬枡锛歅raneel Physics ESAT Hub锛歨ttps://praneelphysics.com/esat/hub锛沀AT锛歨ttps://esat-tmua.ac.uk/esat-preparation-materials/锛沋ouTube锛歨ttps://www.youtube.com/results?search_query=ESAT+Maths+Physics+walkthrough銆備换鍔★細姹囨€讳笁绉戝師濮嬪垎锛屾瘡绉戦€?2 涓笅鍛ㄤ紭鍏?topic锛屽啓涓€椤靛懆鎶ャ€?)
  ];

  // Add sample subtasks to a few key tasks for demonstration
  const tasksWithSubs = tasks.map(t => {
    const sub = (titles) => titles.map(st => ({ id: uid("sub"), title: st, completed: false, createdAt: new Date().toISOString() }));
    if (t.title === "鏁寸悊椤圭洰璇佹嵁鏂囦欢澶?) t.subtasks = sub(["鏁寸悊 ISSDC 椤圭洰鏂囦欢", "鏁寸悊 3D 鎵撳嵃浣滃搧鐓х墖", "鏁寸悊璁烘枃鍒濈鍜岀粓绋?, "鏁寸悊鐏椤圭洰璧勬枡", "姣忎釜椤圭洰鍐?100 瀛楄嫳鏂囨憳瑕?]);
    if (t.title === "鑻卞浗 PS 绗竴鐗?) t.subtasks = sub(["鍒楀嚭鏍稿績宸ョ▼缁忓巻娓呭崟", "鍐欏嚭涓枃绱犳潗鎻愮翰", "杞垚鑻辨枃娈佃惤鍒濈", "淇敼涓荤嚎閫昏緫锛堝缓妯?鍘熷瀷-娴嬭瘯锛?, "璇疯€佸笀/鍚屽鍙嶉"]);
    if (t.title === "鎺ㄨ崘淇℃潗鏂欏寘鍙戠粰鑰佸笀") t.subtasks = sub(["鏁寸悊 1 椤?brag sheet", "鍒楀嚭鏈€甯屾湜鑰佸笀鎻愬埌鐨?3 涓緥瀛?, "鎵撳寘鎴愮哗鍗曞拰椤圭洰璇佹嵁", "纭鎺ㄨ崘淇℃埅姝㈡棩鏈?, "鍙戦偖浠跺苟纭鑰佸笀鏀跺埌"]);
    if (t.title === "Common App 娲诲姩琛ㄥ垵绋?) t.subtasks = sub(["鍒楀嚭鍏ㄩ儴娲诲姩鍜岃鑹?, "鎸夊奖鍝嶅姏鎺掑簭", "绛涢€?10 椤规渶閲嶈鐨?, "鍐欒嫳鏂?150 瀛楃鎻忚堪", "娑﹁壊璇硶鍜屽姩璇?]);
    return t;
  });

  const events = [
    makeEvent("纭 UCAS 涓撲笟缁勫悎", "2026-06-15", "uk", "閿佸畾鍓戞ˉ銆両mperial銆乁CL銆並CL 涓庢浛浠ｅ織鎰跨瓥鐣ャ€?),
    makeEvent("鍚姩 ESAT/TARA 绯荤粺璁粌", "2026-06-20", "exam", "寤虹珛闄愭椂璁粌銆侀敊棰樻湰鍜屾ā鍧楀急鐐硅〃銆?),
    makeEvent("UAT-UK 10 鏈堣€冭瘯棰勭害寮€鏀?, "2026-07-20", "exam", "棰勭害 ESAT/TARA锛岀‘璁よ€冪偣鍜岃瘉浠躲€?),
    makeEvent("Common App 娲诲姩琛ㄥ垵绋?, "2026-07-25", "us", "瀹屾垚娲诲姩鎺掑簭銆佽嫳鏂囨弿杩板拰褰卞搷鍔涜瘉鎹€?),
    makeEvent("鑻卞浗 PS 绗竴鐗?, "2026-08-20", "essay", "褰㈡垚宸ョ▼瀛︽湳涓荤嚎鍜岀礌鏉愬彇鑸嶃€?),
    makeEvent("Common App 閫氬父寮€鏀?, "2026-08-01", "us", "寮€濮嬪～鍐欎俊鎭拰瀛︽牎闄勬枃涔︺€?),
    makeEvent("鎺ㄨ崘淇℃潗鏂欏寘", "2026-08-25", "materials", "鎶?brag sheet 鍙戠粰鎺ㄨ崘鑰佸笀銆?),
    makeEvent("UCAS 淇℃伅涓庢帹鑽愪俊瀹℃牳", "2026-09-10", "uk", "瀛︽牎鍐呴儴瀹℃牳銆侀娴嬪垎銆佺敵璇蜂俊鎭€?),
    makeEvent("ESAT/TARA 鍐插埡", "2026-09-20", "exam", "闄愭椂妯℃嫙銆佽杽寮辨ā鍧楄ˉ寮恒€?),
    makeEvent("ESAT", "2026-10-12", "exam", "涓浗/娓境 October sitting: 10 鏈?12-13 鏃ャ€?),
    makeEvent("ESAT", "2026-10-13", "exam", "涓浗/娓境 October sitting: 10 鏈?12-13 鏃ャ€?),
    makeEvent("TARA", "2026-10-14", "exam", "UCL Robotics and AI 2027 cycle 瑕佹眰銆?),
    makeEvent("鍓戞ˉ UCAS 鎴", "2026-10-15", "uk", "2027 Entry 甯歌鏈鐢宠鎴銆?),
    makeEvent("缇庡浗鏃╃敵鎻愪氦妫€鏌?, "2026-10-25", "us", "ED/EA 鏂囦功銆佹椿鍔ㄣ€佹帹鑽愪俊銆佹爣鍖栥€?),
    makeEvent("鍓戞ˉ闈㈣瘯鍑嗗", "2026-11-20", "uk", "閫氬父闆嗕腑鍦?11 鏈堜笅鏃?12 鏈堜笂鏃€?),
    makeEvent("缇庡浗 RD 鏂囦功涓庤ˉ鍏呮潗鏂?, "2026-12-15", "us", "缁撳悎鏃╃敵缁撴灉璋冩暣 RD銆?),
    makeEvent("UCAS 甯歌鎴", "2027-01-13", "uk", "2027 Entry equal consideration deadline銆?),
    makeEvent("缇庡浗 RD 鎻愪氦绐楀彛", "2027-01-05", "us", "澶氭暟 RD 鎴鍦?1 鏈堜笂鏃嚦涓棳銆?),
    makeEvent("褰曞彇缁撴灉姣旇緝", "2027-03-25", "materials", "姣旇緝鑻辩編 offer銆佸瀛﹂噾銆佷笓涓氬尮閰嶃€?),
    makeEvent("鑻卞浗 offer 鍥炲涓庡悗缁噯澶?, "2027-05-01", "uk", "鏉′欢 offer銆丄P/璇█銆佺璇併€佷綇瀹裤€?),
    makeEvent("ESAT 鏈懆璇婃柇鍛ㄥ鐩?, "2026-06-07", "exam", "妫€鏌?2026-06-01 鍒?2026-06-07 鐨?Maths 1銆丮aths 2銆丳hysics 鍩虹嚎鍒嗘暟銆侀敊棰樺垎绫诲拰涓嬪懆寮辩偣浼樺厛绾с€傝祫鏂欐€诲叆鍙ｏ細UAT https://esat-tmua.ac.uk/esat-preparation-materials/锛汸earson https://www.pearsonvue.com/us/en/uatuk.html銆?)
  ];

  return {
    version: 1,
    importedSeedVersion: "admission-2027-v1",
    sourceReportPath: reportPath,
    generatedAt: new Date().toISOString(),
    goals: [
      {
        id: "goal_admission",
        title: "2027 Entry 鑻辩編宸ョ▼鏂瑰悜鐢宠",
        description: "鍥寸粫宸ョ▼銆佹満鍣ㄤ汉銆佽埅绌鸿埅澶┿€佽蒋纭欢缁撳悎瀹屾垚鐢宠鍑嗗銆?,
        targetDate: "2027-05-01",
        status: "active"
      }
    ],
    projects: [],
    tasks: tasksWithSubs,
    longTasks: [],
    events,
    notes: [
      {
        id: uid("note"),
        content: reportPath
          ? `搴旂敤宸叉娴嬪埌鍗囧鎸囧鎶ュ憡骞跺鍏ユ椂闂寸嚎锛?{reportPath}`
          : "鏈娴嬪埌鍗囧鎸囧鎶ュ憡鏂囦欢锛屽凡浣跨敤鍐呯疆鍗囧鏃堕棿绾垮垵濮嬪寲銆傚彲浠ュ湪鍙充晶璁?AI 甯綘鎷嗗垎浠诲姟銆佽皟鏁存棩绋嬫垨璁板綍鎯虫硶銆?,
        createdAt: new Date().toISOString(),
        tags: ["绯荤粺", "鍗囧瑙勫垝"]
      },
      {
        id: uid("note"),
        content: "ESAT 鏈懆璧勬枡绱㈠紩锛歎AT 瀹樻柟 ESAT 鏍煎紡/鏃ユ湡锛歨ttps://esat-tmua.ac.uk/about-the-tests/esat-test/锛沀AT 瀹樻柟 ESAT guide + ENGAA/NSAA archive锛歨ttps://esat-tmua.ac.uk/esat-preparation-materials/锛汸earson 瀹樻柟鏈鸿€?specimen/sample锛歨ttps://www.pearsonvue.com/us/en/uatuk.html锛汸raneel Physics ESAT Hub锛歨ttps://praneelphysics.com/esat/hub锛沋ouTube锛歁aths 1 https://www.youtube.com/results?search_query=ESAT+Maths+1+walkthrough锛汳aths 2 https://www.youtube.com/results?search_query=ESAT+Maths+2+walkthrough锛汸hysics https://www.youtube.com/results?search_query=ESAT+Physics+walkthrough銆?,
        createdAt: new Date().toISOString(),
        tags: ["ESAT", "鏈懆璁″垝", "璧勬枡"]
      }
    ],
    drafts: [],
    chat: []
  };
}

function getPaths() {
  const dir = app.getPath("userData");
  return {
    dir,
    dataPath: path.join(dir, "planner-data.json"),
    settingsPath: path.join(dir, "settings.json"),
    authSessionPath: path.join(dir, "auth-session.json"),
    backgroundDir: path.join(dir, "backgrounds")
  };
}

function ensureData() {
  const { dir, dataPath } = getPaths();
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify(seedData(), null, 2), "utf8");
  }
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function validateAuthStorageKey(key) {
  if (typeof key !== "string" || !/^sb-[a-z0-9-]+-(?:auth-token|code-verifier)$/i.test(key)) {
    throw new Error("Invalid authentication storage key.");
  }
}

function readAuthStorage(key) {
  validateAuthStorageKey(key);
  const { authSessionPath } = getPaths();
  const stored = readJson(authSessionPath, {});
  const encryptedValue = stored[key];
  if (typeof encryptedValue !== "string" || !encryptedValue) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encryptedValue, "base64"));
  } catch {
    delete stored[key];
    writeJson(authSessionPath, stored);
    return null;
  }
}

function writeAuthStorage(key, value) {
  validateAuthStorageKey(key);
  if (typeof value !== "string" || value.length > 1024 * 1024) {
    throw new Error("Invalid authentication storage value.");
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure session storage is unavailable on this device.");
  }
  const { dir, authSessionPath } = getPaths();
  fs.mkdirSync(dir, { recursive: true });
  const stored = readJson(authSessionPath, {});
  stored[key] = safeStorage.encryptString(value).toString("base64");
  writeJson(authSessionPath, stored);
}

function removeAuthStorage(key) {
  validateAuthStorageKey(key);
  const { authSessionPath } = getPaths();
  const stored = readJson(authSessionPath, {});
  if (!(key in stored)) return;
  delete stored[key];
  writeJson(authSessionPath, stored);
}

function backupCurrentData(reason) {
  const { dataPath, dir } = getPaths();
  if (!fs.existsSync(dataPath)) return "";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  const backupPath = path.join(dir, `planner-data.${reason}-${stamp}.json`);
  fs.copyFileSync(dataPath, backupPath);
  return backupPath;
}

function readData() {
  ensureData();
  const data = normalizePlannerData(readJson(getPaths().dataPath, seedData()));
  saveData(data);
  return data;
}

function saveData(data) {
  const next = { ...data, savedAt: new Date().toISOString() };
  writeJson(getPaths().dataPath, next);
  return next;
}

function getSettings() {
  const raw = readJson(getPaths().settingsPath, {});
  let apiKey = "";
  if (raw.encryptedApiKey) {
    try {
      apiKey = safeStorage.decryptString(Buffer.from(raw.encryptedApiKey, "base64"));
    } catch {
      apiKey = "";
    }
  }
  return {
    activeMode: ["today", "calendar", "planning"].includes(raw.activeMode) ? raw.activeMode : "today",
    planningView: ["tree", "matrix", "split"].includes(raw.planningView) ? raw.planningView : "tree",
    aiDockOpen: Boolean(raw.aiDockOpen),
    appTitle: "NavoPath",
    model: raw.model || DEFAULT_MODEL,
    baseUrl: raw.baseUrl || DEEPSEEK_URL,
    hasApiKey: Boolean(apiKey),
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : "",
    displayName: raw.displayName || "闄堟絿鏉?,
    dailyFocusTime: raw.dailyFocusTime || "20:00",
    weekStartsOn: raw.weekStartsOn === 1 ? 1 : 0,
    theme: raw.theme || "light",
    accentColor: raw.accentColor || "#175cd3",
    executeAccentColor: raw.executeAccentColor || "#C69CF9",
    planningAccentColor: raw.planningAccentColor || "#CAFF72",
    themeGradientEnabled: typeof raw.themeGradientEnabled === "boolean" ? raw.themeGradientEnabled : true,
    aiTone: raw.aiTone || "direct",
    hideCompleted: Boolean(raw.hideCompleted),
    reminderLeadDays: Number.isFinite(raw.reminderLeadDays) ? raw.reminderLeadDays : 7,
    taskNoteDisplay: ["summary", "collapsed", "full"].includes(raw.taskNoteDisplay) ? raw.taskNoteDisplay : "summary",
    glassEnabled: Boolean(raw.glassEnabled),
    backgroundImagePath: raw.backgroundImagePath || "",
    glassBlur: Number.isFinite(raw.glassBlur) ? raw.glassBlur : 18,
    glassOpacity: Number.isFinite(raw.glassOpacity) ? raw.glassOpacity : 88,
    backgroundDim: Number.isFinite(raw.backgroundDim) ? raw.backgroundDim : 12,
    collapsedPanels: Array.isArray(raw.collapsedPanels) ? raw.collapsedPanels : [],
    collapsedSections: Array.isArray(raw.collapsedSections) ? raw.collapsedSections : [],
    panelWidths: {
      left: Number.isFinite(raw.panelWidths?.left) ? raw.panelWidths.left : 310,
      right: Number.isFinite(raw.panelWidths?.right) ? raw.panelWidths.right : 360
    },
    chatMessageMaxHeight: Number.isFinite(raw.chatMessageMaxHeight) ? raw.chatMessageMaxHeight : 220,
    aiMemoryEnabled: raw.aiMemoryEnabled !== false,
    addAdvancedOpen: Boolean(raw.addAdvancedOpen),
    dayStartTime: raw.dayStartTime || "00:00"
  };
}

function saveSettings(settings) {
  const existing = readJson(getPaths().settingsPath, {});
  const next = {
    activeMode: ["today", "calendar", "planning"].includes(settings.activeMode) ? settings.activeMode : existing.activeMode || "today",
    planningView: ["tree", "matrix", "split"].includes(settings.planningView) ? settings.planningView : existing.planningView || "tree",
    aiDockOpen: typeof settings.aiDockOpen === "boolean" ? settings.aiDockOpen : Boolean(existing.aiDockOpen),
    addAdvancedOpen: typeof settings.addAdvancedOpen === "boolean" ? settings.addAdvancedOpen : Boolean(existing.addAdvancedOpen),
    appTitle: "NavoPath",
    model: settings.model || existing.model || DEFAULT_MODEL,
    baseUrl: settings.baseUrl || existing.baseUrl || DEEPSEEK_URL,
    displayName: settings.displayName || existing.displayName || "闄堟絿鏉?,
    dailyFocusTime: settings.dailyFocusTime || existing.dailyFocusTime || "20:00",
    weekStartsOn: typeof settings.weekStartsOn === "number" ? (settings.weekStartsOn === 1 ? 1 : 0) : existing.weekStartsOn === 1 ? 1 : 0,
    theme: settings.theme || existing.theme || "light",
    accentColor: settings.accentColor || existing.accentColor || "#175cd3",
    executeAccentColor: settings.executeAccentColor || existing.executeAccentColor || "#C69CF9",
    planningAccentColor: settings.planningAccentColor || existing.planningAccentColor || "#CAFF72",
    themeGradientEnabled: typeof settings.themeGradientEnabled === "boolean" ? settings.themeGradientEnabled : existing.themeGradientEnabled !== false,
    aiTone: settings.aiTone || existing.aiTone || "direct",
    hideCompleted: typeof settings.hideCompleted === "boolean" ? settings.hideCompleted : Boolean(existing.hideCompleted),
    reminderLeadDays: Number.isFinite(settings.reminderLeadDays) ? settings.reminderLeadDays : existing.reminderLeadDays || 7,
    taskNoteDisplay: ["summary", "collapsed", "full"].includes(settings.taskNoteDisplay)
      ? settings.taskNoteDisplay
      : existing.taskNoteDisplay || "summary",
    glassEnabled: typeof settings.glassEnabled === "boolean" ? settings.glassEnabled : Boolean(existing.glassEnabled),
    backgroundImagePath: typeof settings.backgroundImagePath === "string" ? settings.backgroundImagePath : existing.backgroundImagePath || "",
    glassBlur: Number.isFinite(settings.glassBlur) ? settings.glassBlur : Number.isFinite(existing.glassBlur) ? existing.glassBlur : 18,
    glassOpacity: Number.isFinite(settings.glassOpacity) ? settings.glassOpacity : Number.isFinite(existing.glassOpacity) ? existing.glassOpacity : 88,
    backgroundDim: Number.isFinite(settings.backgroundDim) ? settings.backgroundDim : Number.isFinite(existing.backgroundDim) ? existing.backgroundDim : 12,
    collapsedPanels: Array.isArray(settings.collapsedPanels) ? settings.collapsedPanels : Array.isArray(existing.collapsedPanels) ? existing.collapsedPanels : [],
    collapsedSections: Array.isArray(settings.collapsedSections) ? settings.collapsedSections : Array.isArray(existing.collapsedSections) ? existing.collapsedSections : [],
    panelWidths: {
      left: Number.isFinite(settings.panelWidths?.left)
        ? settings.panelWidths.left
        : Number.isFinite(existing.panelWidths?.left)
          ? existing.panelWidths.left
          : 310,
      right: Number.isFinite(settings.panelWidths?.right)
        ? settings.panelWidths.right
        : Number.isFinite(existing.panelWidths?.right)
          ? existing.panelWidths.right
          : 360
    },
    chatMessageMaxHeight: Number.isFinite(settings.chatMessageMaxHeight)
      ? settings.chatMessageMaxHeight
      : Number.isFinite(existing.chatMessageMaxHeight)
        ? existing.chatMessageMaxHeight
        : 220,
    aiMemoryEnabled: typeof settings.aiMemoryEnabled === "boolean" ? settings.aiMemoryEnabled : existing.aiMemoryEnabled !== false,
    dayStartTime: settings.dayStartTime || existing.dayStartTime || "00:00",
    updatedAt: new Date().toISOString()
  };
  if (settings.apiKey && settings.apiKey.trim()) {
    next.encryptedApiKey = safeStorage.encryptString(settings.apiKey.trim()).toString("base64");
  } else if (settings.clearApiKey) {
    next.encryptedApiKey = "";
  } else {
    next.encryptedApiKey = existing.encryptedApiKey || "";
  }
  writeJson(getPaths().settingsPath, next);
  return getSettings();
}

function getApiKey() {
  const raw = readJson(getPaths().settingsPath, {});
  if (!raw.encryptedApiKey) return "";
  try {
    return safeStorage.decryptString(Buffer.from(raw.encryptedApiKey, "base64"));
  } catch {
    return "";
  }
}

function summarizeData(data) {
  const openTasks = data.tasks.filter((task) => !task.completed).slice(0, 30);
  const events = data.events
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 40);
  const notes = data.notes.slice(-8);
  return JSON.stringify(
    {
      today: todayIso(),
      goals: data.goals,
      openTasks,
      longTasks: data.longTasks || [],
      upcomingEvents: events,
      recentNotes: notes,
      aiMemories: (data.aiMemories || []).slice(-20)
    },
    null,
    2
  );
}

function extractJson(content) {
  // Try ```json fence first, then plain ``` fence, then raw { }
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : content;
  const first = source.indexOf("{");
  const last = source.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(source.slice(first, last + 1));
  } catch {
    return null;
  }
}

function normalizeAiResponse(content) {
  const parsed = extractJson(content);
  if (parsed && (parsed.reply || Array.isArray(parsed.actions))) {
    return {
      reply: parsed.reply || content,
      actions: Array.isArray(parsed.actions) ? parsed.actions : []
    };
  }
  return { reply: content, actions: [] };
}

function applyActions(actions) {
  const data = readData();
  const applied = [];
  for (const action of actions || []) {
    if (!action || typeof action !== "object") continue;
    if (action.type === "add_task" && action.title && action.dueDate) {
      const task = makeTask(
        String(action.title),
        String(action.dueDate),
        action.category || "personal",
        action.priority || "medium",
        action.notes || "",
        action.goalId || "goal_admission"
      );
      if (Array.isArray(action.subtasks) && action.subtasks.length > 0) {
        task.subtasks = action.subtasks.map((st, i) => ({
          id: uid("sub"),
          title: String(st.title || st),
          completed: false,
          createdAt: new Date().toISOString()
        }));
      }
      data.tasks.push(task);
      applied.push({ type: "add_task", id: task.id, title: task.title });
    }
    if (action.type === "reschedule_task" && action.taskId && action.dueDate) {
      const task = data.tasks.find((item) => item.id === action.taskId);
      if (task) {
        task.dueDate = String(action.dueDate);
        task.updatedAt = new Date().toISOString();
        applied.push({ type: "reschedule_task", id: task.id, title: task.title });
      }
    }
    if (action.type === "add_event" && action.title && action.date) {
      const event = makeEvent(String(action.title), String(action.date), action.category || "personal", action.details || "");
      event.imported = false;
      data.events.push(event);
      applied.push({ type: "add_event", id: event.id, title: event.title });
    }
    if (action.type === "add_note" && action.content) {
      const note = {
        id: uid("note"),
        content: String(action.content),
        createdAt: new Date().toISOString(),
        tags: Array.isArray(action.tags) ? action.tags : []
      };
      data.notes.push(note);
      applied.push({ type: "add_note", id: note.id, title: note.content.slice(0, 30) });
    }
    if (action.type === "add_memory" && action.content) {
      const now = new Date().toISOString();
      const memory = {
        id: uid("memory"),
        content: String(action.content).slice(0, 500),
        tags: Array.isArray(action.tags) ? action.tags.slice(0, 6).map(String) : [],
        createdAt: now,
        updatedAt: now
      };
      data.aiMemories = Array.isArray(data.aiMemories) ? data.aiMemories : [];
      const exists = data.aiMemories.some((item) => item.content.trim() === memory.content.trim());
      if (!exists) {
        data.aiMemories.push(memory);
        applied.push({ type: "add_memory", id: memory.id, title: memory.content.slice(0, 30) });
      }
    }
  }
  return { data: saveData(data), applied };
}

async function selectBackgroundImage() {
  const result = await dialog.showOpenDialog({
    title: "閫夋嫨鑳屾櫙鍥剧墖",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { path: "" };
  const source = result.filePaths[0];
  const ext = path.extname(source).toLowerCase() || ".png";
  const { backgroundDir } = getPaths();
  fs.mkdirSync(backgroundDir, { recursive: true });
  const target = path.join(backgroundDir, `background${ext}`);
  fs.copyFileSync(source, target);
  const settings = saveSettings({ backgroundImagePath: target });
  return { path: settings.backgroundImagePath };
}

async function callDeepSeek({ messages = [], draftText = "" }) {
  const settings = getSettings();
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("璇峰厛鍦ㄥ彸涓婅璁剧疆 DeepSeek API Key銆?);
  }
  const data = readData();
  const system = [
    "浣犳槸涓€涓暀瀛﹀崌瀛﹀璇濆姪鎵嬨€備綘闇€瑕佹牴鎹敤鎴疯緭鍏ュ喅瀹氳繑鍥炴牸寮忋€?,
    "濡傛灉闇€瑕佸垱寤轰换鍔?/ 浜嬩欢 / 绗旇 / 璁板繂锛屽繀椤诲彧杩斿洖绾?JSON锛屼笉瑕佺敤 markdown 浠ｇ爜鍧楋紙涓嶈鐢?```锛夛紝涓嶈鍔犱换浣曞墠缂€鏂囧瓧锛?,
    '{"reply":"浣犵殑涓枃鍥炲","actions":[{"type":"add_task","title":"...","dueDate":"YYYY-MM-DD","category":"exam|uk|us|essay|materials|project|personal","priority":"high|medium|low","notes":"鐩爣锛?..\\n琛￠噺锛?..\\n琛屽姩锛?..\\n璧勬枡锛?..\\n瀹屾垚鏍囧噯锛?..","subtasks":[{"title":"瀛愪换鍔?}]}]}',
    "濡傛灉鍙槸鏅€氳亰澶┿€佷笉闇€瑕佸垱寤?淇敼浠讳綍鏁版嵁锛岀洿鎺ヨ繑鍥炵函鏂囨湰锛屼笉瑕佺敤 JSON銆?,
    "浠诲姟澶囨敞蹇呴』涓ユ牸鎸?SMART 浜旀鍐欙紙鐩爣锛?琛￠噺锛?琛屽姩锛?璧勬枡锛?瀹屾垚鏍囧噯锛氾級銆傛瘡涓瓙浠诲姟鏍囬 15 瀛椾互鍐呫€?,
    "鍙敤 action锛歛dd_task銆乺eschedule_task銆乤dd_event銆乤dd_note銆乤dd_memory銆?,
    "闄や簡 add_memory锛屽叾浠?action 涓嶈璇?宸叉墽琛?鈥斺€斿簲鐢ㄤ細灞曠ず棰勮锛岀敱鐢ㄦ埛鐐瑰嚮纭銆?,
    `鏈湴鏁版嵁鎽樿锛?{summarizeData(data)}`
  ].join("\n");

  const hasSystemMessage = messages.length > 0 && messages[0].role === "system";
  const body = {
    model: settings.model || DEFAULT_MODEL,
    messages: [
      ...(hasSystemMessage ? [] : [{ role: "system", content: system }]),
      ...messages.slice(-10),
      ...(draftText ? [{ role: "user", content: draftText }] : [])
    ],
    temperature: 0.4,
    max_tokens: 4096,
    stream: false
  };

  const response = await fetch(settings.baseUrl || DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek 璇锋眰澶辫触锛?{response.status} ${text.slice(0, 200)}`);
  }
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content || "";
  return normalizeAiResponse(content);
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "navopath-icon.png")
    : path.join(__dirname, "..", "public", "navopath-icon.png");

  // Determine app URL: use local file in production, dev server or remote in development
  let appUrl;
  let allowedOrigin;
  if (app.isPackaged) {
    // Production: load local file
    const indexPath = path.join(app.getAppPath(), "dist", "index.html");
    appUrl = new URL("file://${indexPath}");
    allowedOrigin = "file://";
  } else {
    // Development
    const configuredUrl = process.env.VITE_DEV_SERVER_URL || process.env.NAVOPATH_APP_URL || "https://navopath-xiaoyang.pages.dev";
    appUrl = new URL("/app", configuredUrl);
    allowedOrigin = appUrl.origin;
  }

  const isWorkspaceUrl = (url) => {
    try {
      const target = new URL(url);
      if (app.isPackaged) {
        // In production, allow local files
        return target.protocol === "file:";
      }
      return target.origin === allowedOrigin && (target.pathname === "/app" || target.pathname.startsWith("/app/"));
    } catch {
      return false;
    }
  };

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: "NavoPath",
    icon: iconPath,
    backgroundColor: "#f5f7fb",
    show: false, // Don't show until ready-to-show
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Show window when content is ready for faster perceived performance
  win.once("ready-to-show", () => {
    win.show();
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (isWorkspaceUrl(url)) return;
    event.preventDefault();
    const target = new URL(url);
    if (!app.isPackaged && target.origin === allowedOrigin && target.pathname === "/") {
      void win.loadURL(appUrl.toString());
      return;
    }
    void shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWorkspaceUrl(url)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (app.isPackaged) {
    win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  } else {
    win.loadURL(appUrl.toString());
  }
}
app.whenReady().then(() => {
  // Create window first for fastest perceived startup
  createWindow();
  
  // Defer non-critical initialization to background
  setImmediate(() => {
    ensureData();
    createTray();
    configureAutoUpdater();
  });
  
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let isQuitting = false;
let tray = null;

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), "dist", "navopath-icon.png")
    : path.join(__dirname, "..", "public", "navopath-icon.png");
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) trayIcon = nativeImage.createEmpty();
  } catch {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: "鏄剧ず NavoPath", click: () => { const win = BrowserWindow.getAllWindows()[0]; if (win) { win.show(); win.focus(); } else createWindow(); } },
    { type: "separator" },
    { label: "閫€鍑?, click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip("NavoPath");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { win.show(); win.focus(); } else createWindow();
  });
}

app.on("before-quit", () => { isQuitting = true; });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Keep app alive in tray; only quit when user explicitly exits from tray
    if (!isQuitting) {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.hide();
    } else {
      app.quit();
    }
  }
});

ipcMain.handle("planner:getData", () => readData());
ipcMain.handle("planner:saveData", (_event, data) => saveData(data));
ipcMain.handle("planner:applyActions", (_event, actions) => applyActions(actions));
ipcMain.handle("planner:resetSeed", () => {
  backupCurrentData("before-reset");
  return saveData(normalizePlannerData(seedData()));
});
ipcMain.handle("settings:get", () => getSettings());
ipcMain.handle("settings:save", (_event, settings) => saveSettings(settings));
ipcMain.handle("settings:selectBackgroundImage", () => selectBackgroundImage());
ipcMain.handle("auth-storage:get", (_event, key) => readAuthStorage(key));
ipcMain.handle("auth-storage:set", (_event, key, value) => writeAuthStorage(key, value));
ipcMain.handle("auth-storage:remove", (_event, key) => removeAuthStorage(key));
ipcMain.handle("ai:chat", (_event, payload) => callDeepSeek(payload));
ipcMain.handle("updater:getState", () => updateState);
ipcMain.handle("updater:check", async () => {
  try {
    return await checkForDesktopUpdate(true);
  } catch (error) {
    return publishUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
  }
});
ipcMain.handle("updater:install", () => {
  if (updateState.status !== "downloaded") return false;
  setImmediate(() => {
    const autoUpdater = getAutoUpdater();
    if (typeof autoUpdater.quitAndInstall !== "function") {
      publishUpdateState({
        status: "error",
        message: "The downloaded update cannot be installed automatically. Please download the latest installer manually."
      });
      return;
    }
    autoUpdater.quitAndInstall(false, true);
  });
  return true;
});

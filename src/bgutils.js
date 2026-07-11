/* ===== bgutils-js v3.2.0, vendored verbatim =====
   https://github.com/LuanRT/BgUtils (MIT license, © LuanRT)
   Downloaded straight from the npm registry tarball (not paraphrased/
   reconstructed) and merged from its several dist/*.js ES modules into
   one file, since this app has no bundler. Logic is untouched byte-for-
   byte per function - only the import/export wiring was flattened.

   This is the orchestration/plumbing for YouTube's "BotGuard" attestation
   flow (what mints a PoToken) - it does NOT contain Google's actual
   attestation code, which is fetched live per-session from YouTube/Google
   in potoken.js and only ever eval'd, never stored here. See potoken.js
   for how this is used on the Android download path (innertube.js
   playback requires a valid PoToken as of 2025's stricter bot-check). */

// ---- utils/constants.js ----
const GOOG_BASE_URL = 'https://jnn-pa.googleapis.com';
const YT_BASE_URL = 'https://www.youtube.com';
const GOOG_API_KEY = 'AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36(KHTML, like Gecko)';

// ---- utils/helpers.js ----
const base64urlCharRegex = /[-_.]/g;
const base64urlToBase64Map = { '-': '+', _: '/', '.': '=' };

class DeferredPromise {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class BGError extends TypeError {
  constructor(code, message, info) {
    super(message);
    this.name = 'BGError';
    this.code = code;
    if (info) this.info = info;
  }
}

function base64ToU8(base64) {
  let base64Mod;
  if (base64urlCharRegex.test(base64)) {
    base64Mod = base64.replace(base64urlCharRegex, (match) => base64urlToBase64Map[match]);
  } else {
    base64Mod = base64;
  }
  base64Mod = atob(base64Mod);
  return new Uint8Array([...base64Mod].map((char) => char.charCodeAt(0)));
}

function u8ToBase64(u8, base64url = false) {
  const result = btoa(String.fromCharCode(...u8));
  if (base64url) {
    return result.replace(/\+/g, '-').replace(/\//g, '_');
  }
  return result;
}

function isBrowser() {
  const isBrowserEnv =
    typeof window !== 'undefined' &&
    typeof window.document !== 'undefined' &&
    typeof window.document.createElement !== 'undefined' &&
    typeof window.HTMLElement !== 'undefined' &&
    typeof window.navigator !== 'undefined';
  return isBrowserEnv;
}

function getHeaders() {
  const headers = {
    'content-type': 'application/json+protobuf',
    'x-goog-api-key': GOOG_API_KEY,
    'x-user-agent': 'grpc-web-javascript/0.1',
  };
  if (!isBrowser()) {
    headers['user-agent'] = USER_AGENT;
  }
  return headers;
}

function buildURL(endpointName, useYouTubeAPI) {
  return `${useYouTubeAPI ? YT_BASE_URL : GOOG_BASE_URL}/${useYouTubeAPI ? 'api/jnn/v1' : '$rpc/google.internal.waa.v1.Waa'}/${endpointName}`;
}

// ---- core/challengeFetcher.js ----
async function challengeCreate(bgConfig, interpreterHash) {
  const requestKey = bgConfig.requestKey;
  if (!bgConfig.fetch) throw new BGError('BAD_CONFIG', 'No fetch function provided');
  const payload = [requestKey];
  if (interpreterHash) payload.push(interpreterHash);
  const response = await bgConfig.fetch(buildURL('Create', bgConfig.useYouTubeAPI), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new BGError('REQUEST_FAILED', 'Failed to fetch challenge', { status: response.status });
  const rawData = await response.json();
  return parseChallengeData(rawData);
}

function parseChallengeData(rawData) {
  let challengeData = [];
  if (rawData.length > 1 && typeof rawData[1] === 'string') {
    const descrambled = descramble(rawData[1]);
    challengeData = JSON.parse(descrambled || '[]');
  } else if (rawData.length && typeof rawData[0] === 'object') {
    challengeData = rawData[0];
  }
  const [messageId, wrappedScript, wrappedUrl, interpreterHash, program, globalName, , clientExperimentsStateBlob] = challengeData;
  const privateDoNotAccessOrElseSafeScriptWrappedValue = Array.isArray(wrappedScript)
    ? wrappedScript.find((value) => value && typeof value === 'string')
    : null;
  const privateDoNotAccessOrElseTrustedResourceUrlWrappedValue = Array.isArray(wrappedUrl)
    ? wrappedUrl.find((value) => value && typeof value === 'string')
    : null;
  return {
    messageId,
    interpreterJavascript: {
      privateDoNotAccessOrElseSafeScriptWrappedValue,
      privateDoNotAccessOrElseTrustedResourceUrlWrappedValue,
    },
    interpreterHash,
    program,
    globalName,
    clientExperimentsStateBlob,
  };
}

function descramble(scrambledChallenge) {
  const buffer = base64ToU8(scrambledChallenge);
  if (buffer.length) return new TextDecoder().decode(buffer.map((b) => b + 97));
}

// ---- core/botGuardClient.js ----
class BotGuardClient {
  constructor(options) {
    this.deferredVmFunctions = new DeferredPromise();
    this.defaultTimeout = 3000;
    this.userInteractionElement = options.userInteractionElement;
    this.vm = options.globalObj[options.globalName];
    this.program = options.program;
  }

  static async create(options) {
    return await new BotGuardClient(options).load();
  }

  async load() {
    if (!this.vm) throw new BGError('VM_INIT', 'VM not found');
    if (!this.vm.a) throw new BGError('VM_INIT', 'VM init function not found');
    const vmFunctionsCallback = (asyncSnapshotFunction, shutdownFunction, passEventFunction, checkCameraFunction) => {
      this.deferredVmFunctions.resolve({ asyncSnapshotFunction, shutdownFunction, passEventFunction, checkCameraFunction });
    };
    try {
      this.syncSnapshotFunction = await this.vm.a(
        this.program,
        vmFunctionsCallback,
        true,
        this.userInteractionElement,
        () => {},
        [[], []]
      )[0];
    } catch (error) {
      throw new BGError('VM_ERROR', 'Could not load program', { error });
    }
    return this;
  }

  async snapshot(args, timeout = 3000) {
    return await Promise.race([
      new Promise(async (resolve, reject) => {
        const vmFunctions = await this.deferredVmFunctions.promise;
        if (!vmFunctions.asyncSnapshotFunction) return reject(new BGError('ASYNC_SNAPSHOT', 'Asynchronous snapshot function not found'));
        await vmFunctions.asyncSnapshotFunction((response) => resolve(response), [
          args.contentBinding,
          args.signedTimestamp,
          args.webPoSignalOutput,
          args.skipPrivacyBuffer,
        ]);
      }),
      new Promise((_, reject) => setTimeout(() => reject(new BGError('TIMEOUT', 'VM operation timed out')), timeout)),
    ]);
  }
}

// ---- core/webPoMinter.js ----
class WebPoMinter {
  constructor(mintCallback) {
    this.mintCallback = mintCallback;
  }

  static async create(integrityTokenResponse, webPoSignalOutput) {
    const getMinter = webPoSignalOutput[0];
    if (!getMinter) throw new BGError('VM_ERROR', 'PMD:Undefined');
    if (!integrityTokenResponse.integrityToken) throw new BGError('INTEGRITY_ERROR', 'No integrity token provided', { integrityTokenResponse });
    const mintCallback = await getMinter(base64ToU8(integrityTokenResponse.integrityToken));
    if (!(mintCallback instanceof Function)) throw new BGError('VM_ERROR', 'APF:Failed');
    return new WebPoMinter(mintCallback);
  }

  async mintAsWebsafeString(identifier) {
    const result = await this.mint(identifier);
    return u8ToBase64(result, true);
  }

  async mint(identifier) {
    const result = await this.mintCallback(new TextEncoder().encode(identifier));
    if (!result) throw new BGError('VM_ERROR', 'YNJ:Undefined');
    if (!(result instanceof Uint8Array)) throw new BGError('VM_ERROR', 'ODM:Invalid');
    return result;
  }
}

// ---- core/webPoClient.js ----
async function poTokenGenerate(args) {
  const { program, bgConfig, globalName } = args;
  const { identifier } = bgConfig;
  const botguard = await BotGuardClient.create({ program, globalName, globalObj: bgConfig.globalObj });
  const webPoSignalOutput = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });
  const payload = [bgConfig.requestKey, botguardResponse];
  const integrityTokenResponse = await bgConfig.fetch(buildURL('GenerateIT', bgConfig.useYouTubeAPI), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const integrityTokenJson = await integrityTokenResponse.json();
  const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] = integrityTokenJson;
  const integrityTokenData = { integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken };
  const webPoMinter = await WebPoMinter.create(integrityTokenData, webPoSignalOutput);
  const poToken = await webPoMinter.mintAsWebsafeString(identifier);
  return { poToken, integrityTokenData };
}

// ---- public API (mirrors the real package's `BG` namespace) ----
export const Challenge = { create: challengeCreate, parseChallengeData, descramble };
export const PoToken = { generate: poTokenGenerate };
export { BotGuardClient, WebPoMinter, BGError };

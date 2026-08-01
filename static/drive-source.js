const DriveSource = (() => {
  const CLIENT_ID = "713724821399-6j8iefsj363ok89vb6447c7lbto628uo.apps.googleusercontent.com";
  const ROOT_FOLDER_ID = "1oEXzLFWZQxgXXvjZUGSErxJze_amg4EJ";
  const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
  const FOLDER = "application/vnd.google-apps.folder";
  const SHORTCUT = "application/vnd.google-apps.shortcut";
  const AUDIO = new Set(["mp3", "m4a", "aac", "wav", "flac", "ogg"]);
  const VIDEO = new Set(["mp4", "m4v", "mov", "webm"]);
  const IMAGE = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "heic"]);
  const FORMAT_PRIORITY = {png: 0, jpg: 1, jpeg: 1, webp: 2, avif: 3, heic: 4, gif: 5};
  const objectUrls = new Map();
  let accessToken = null;
  let tokenClient = null;

  const extension = name => name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const cleanTitle = name => name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  const stableId = id => `drive-${id}`;
  const rootCollection = name => {
    const text = cleanTitle(name).toLowerCase();
    const rules = [
      ["Confidence & Self-Worth", ["confidence", "self esteem", "self image", "worthy", "canvd"]],
      ["Mindfulness & Calm", ["meditation", "mindfulness", "anxiety", "acceptance", "being still"]],
      ["Motivation & Reprogramming", ["motivational", "brainwashing", "reprogram", "best you"]],
      ["Hypnosis & Sleep", ["hypnosis", "hypnotic", "sleep", "asmr", "healthy eating"]],
      ["Healing & Integration", ["heal", "neuroscience", "gabriele", "aaron", "merge higher"]],
      ["Personal Recordings", ["replay", "recording", "voice memo"]],
    ];
    return rules.find(([, words]) => words.some(word => text.includes(word)))?.[0] || "Other Meditations";
  };
  const tags = (title, collection) => {
    const text = `${title} ${collection}`.toLowerCase();
    const rules = {sleep:["sleep","dream","night","rest"],calm:["calm","anxiety","safe","reiki"],confidence:["confidence","self esteem","worthy"],healing:["heal","wound","abandon","rejected"],affirmations:["affirmation","i am"],hypnosis:["hypnosis","hypnotic"]};
    const found = Object.entries(rules).filter(([, words]) => words.some(word => text.includes(word))).map(([tag]) => tag);
    return found.length ? found : ["general"];
  };

  function ready() {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(timer); resolve(); }
        else if (Date.now() - started > 10000) { clearInterval(timer); reject(new Error("Google sign-in did not load")); }
      }, 100);
    });
  }

  async function connect() {
    await ready();
    return new Promise((resolve, reject) => {
      tokenClient ||= google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: response => {
          if (response.error) { reject(new Error(response.error)); return; }
          accessToken = response.access_token;
          resolve(response);
        },
        error_callback: error => reject(new Error(error.type || "Google sign-in closed")),
      });
      tokenClient.requestAccessToken({prompt: accessToken ? "" : "consent"});
    });
  }

  async function driveFetch(path, options = {}) {
    if (!accessToken) throw new Error("Google Drive is not connected");
    const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
      ...options,
      headers: {...options.headers, Authorization: `Bearer ${accessToken}`},
    });
    if (response.status === 401) accessToken = null;
    if (!response.ok) throw new Error(`Google Drive returned ${response.status}`);
    return response;
  }

  async function fileInfo(id) {
    const fields = "id,name,mimeType,size,modifiedTime,shortcutDetails,videoMediaMetadata";
    return driveFetch(`files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`).then(r => r.json());
  }

  async function children(folderId) {
    const files = [];
    let pageToken = "";
    do {
      const query = `'${folderId}' in parents and trashed=false`;
      const fields = "nextPageToken,files(id,name,mimeType,size,modifiedTime,shortcutDetails,videoMediaMetadata)";
      const params = new URLSearchParams({q: query, fields, pageSize: "1000", supportsAllDrives: "true", includeItemsFromAllDrives: "true"});
      if (pageToken) params.set("pageToken", pageToken);
      const data = await driveFetch(`files?${params}`).then(r => r.json());
      files.push(...data.files);
      pageToken = data.nextPageToken || "";
    } while (pageToken);
    return files;
  }

  async function walk(folderId, path = [], seen = new Set()) {
    if (seen.has(folderId)) return [];
    seen.add(folderId);
    const output = [];
    for (const original of await children(folderId)) {
      let file = original;
      let isAlias = false;
      if (file.mimeType === SHORTCUT && file.shortcutDetails?.targetId) {
        file = await fileInfo(file.shortcutDetails.targetId);
        file = {...file, name: original.name || file.name};
        isAlias = true;
      }
      if (file.mimeType === FOLDER) {
        output.push(...await walk(file.id, [...path, original.name], seen));
        continue;
      }
      const ext = extension(file.name);
      const kind = AUDIO.has(ext) || file.mimeType.startsWith("audio/") ? "audio" : VIDEO.has(ext) || file.mimeType.startsWith("video/") ? "video" : IMAGE.has(ext) || file.mimeType.startsWith("image/") ? "image" : null;
      if (!kind) continue;
      const collection = path[0] || rootCollection(file.name);
      const title = cleanTitle(file.name);
      output.push({
        id: stableId(file.id), source_id: file.id, title, filename: file.name,
        relative_path: [...path, file.name].join("/"), collection, kind,
        mime_type: file.mimeType, size_bytes: Number(file.size || 0),
        duration_seconds: file.videoMediaMetadata?.durationMillis ? Number(file.videoMediaMetadata.durationMillis) / 1000 : null,
        modified_at: file.modifiedTime ? Date.parse(file.modifiedTime) / 1000 : null,
        is_alias: isAlias, tags: tags(title, collection), cover_id: null,
      });
    }
    return output;
  }

  async function response(item) {
    return driveFetch(`files/${encodeURIComponent(item.source_id)}?alt=media&supportsAllDrives=true`);
  }

  async function objectUrl(item) {
    if (objectUrls.has(item.id)) return objectUrls.get(item.id);
    const url = URL.createObjectURL(await (await response(item)).blob());
    objectUrls.set(item.id, url);
    return url;
  }

  async function scan() {
    const items = await walk(ROOT_FOLDER_ID);
    const images = new Map();
    items.filter(item => item.kind === "image").forEach(item => {
      if (!images.has(item.collection)) images.set(item.collection, []);
      images.get(item.collection).push(item);
    });
    for (const collectionImages of images.values()) {
      collectionImages.sort((a, b) => {
        const named = item => /cover|artwork|folder|front/i.test(item.title) ? 0 : 1;
        return named(a) - named(b) || (FORMAT_PRIORITY[extension(a.filename)] ?? 99) - (FORMAT_PRIORITY[extension(b.filename)] ?? 99) || a.title.localeCompare(b.title);
      });
      const cover = collectionImages[0];
      try { cover.cover_url = await objectUrl(cover); } catch (_) { /* retain fallback art */ }
      items.filter(item => item.collection === cover.collection).forEach(item => {
        item.cover_id = cover.id;
        item.cover_url = cover.cover_url;
      });
    }
    return items;
  }

  return {connect, scan, response, objectUrl, get connected() { return Boolean(accessToken); }};
})();

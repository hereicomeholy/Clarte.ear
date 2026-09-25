const CLIENT_ID = "181481689841-quvks7a9ehf5k65n6cv4vse1eb7fp8f1.apps.googleusercontent.com";
const API_KEY = "AIzaSyC8msU1nCh45QWugu4rUrrMDF_IU40x9X8";
const APP_ID = "181481689841";
const OWNER_EMAIL = "leslie021922@gmail.com";
const VIEWER_EMAIL = "ozeths@gmail.com";
const BACKUP_NAME = "Clarté Ear 資料備份.json";
const FOLDER_NAME = "Clarté Ear Backups";

type GoogleWindow = Window & {
  google?: any;
  gapi?: any;
};

export type DriveRole = "owner" | "viewer";
export type DriveConnection = {
  token: string;
  email: string;
  role: DriveRole;
  expiresAt: number;
};

function loadScript(src: string, marker: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-clarte="${marker}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.clarte = marker;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("無法載入 Google 連線服務"));
    document.head.appendChild(script);
  });
}

async function requestGoogleDriveConnection(
  prompt: "consent" | "",
  expectedRole?: DriveRole,
): Promise<DriveConnection> {
  await loadScript("https://accounts.google.com/gsi/client", "google-identity");
  const google = (window as GoogleWindow).google;
  if (!google?.accounts?.oauth2) throw new Error("Google 登入服務尚未就緒");
  const tokenResponse: any = await new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      hint:
        prompt === ""
          ? expectedRole === "owner"
            ? OWNER_EMAIL
            : VIEWER_EMAIL
          : undefined,
      scope:
        "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file",
      callback: (response: any) =>
        response?.error ? reject(new Error(response.error)) : resolve(response),
      error_callback: () => reject(new Error("Google 登入已取消")),
    });
    client.requestAccessToken({ prompt });
  });
  const profileResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } },
  );
  if (!profileResponse.ok) throw new Error("無法確認 Google 帳號");
  const profile = (await profileResponse.json()) as { email?: string };
  const email = String(profile.email || "").toLowerCase();
  if (email !== OWNER_EMAIL && email !== VIEWER_EMAIL)
    throw new Error("此 Google 帳號沒有 Clarté Ear 的使用權限");
  return {
    token: tokenResponse.access_token,
    email,
    role: email === OWNER_EMAIL ? "owner" : "viewer",
    expiresAt: Date.now() + Number(tokenResponse.expires_in || 3600) * 1000,
  };
}

export function connectGoogleDrive(): Promise<DriveConnection> {
  return requestGoogleDriveConnection("consent");
}

// Reuses an existing Google session without showing an account chooser. Google
// may reject this when Safari has cleared the session; the manual button then
// remains available for the user to approve access again.
export function reconnectGoogleDriveSilently(
  expectedRole: DriveRole = "viewer",
): Promise<DriveConnection> {
  return requestGoogleDriveConnection("", expectedRole);
}

async function driveRequest(token: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Drive 無法完成操作（${response.status}）${detail ? `：${detail.slice(0, 100)}` : ""}`);
  }
  return response;
}

async function findFile(token: string, name: string, mimeType?: string) {
  const clauses = [
      `name='${name.replaceAll("'", "\\'")}'`,
      "trashed=false",
      ...(mimeType ? [`mimeType='${mimeType}'`] : []),
    ],
    params = new URLSearchParams({
      q: clauses.join(" and "),
      spaces: "drive",
      fields: "files(id,name,modifiedTime)",
      pageSize: "10",
    }),
    response = await driveRequest(
      token,
      `https://www.googleapis.com/drive/v3/files?${params}`,
    ),
    body = (await response.json()) as { files?: { id: string }[] };
  return body.files?.[0]?.id || "";
}

async function createDriveFile(
  token: string,
  metadata: Record<string, unknown>,
  contents?: unknown,
) {
  if (contents === undefined) {
    const response = await driveRequest(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    });
    return String((await response.json()).id);
  }
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(contents, null, 2)], { type: "application/json" }));
  const response = await driveRequest(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", body: form },
  );
  return String((await response.json()).id);
}

async function updateDriveFile(token: string, fileId: string, contents: unknown) {
  await driveRequest(
    token,
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contents, null, 2),
    },
  );
}

export async function prepareOwnerBackup(token: string, data: unknown) {
  let folderId = await findFile(
    token,
    FOLDER_NAME,
    "application/vnd.google-apps.folder",
  );
  if (!folderId)
    folderId = await createDriveFile(token, {
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    });
  let fileId = await findFile(token, BACKUP_NAME, "application/json");
  const payload = { format: "clarte-ear-backup-v1", updatedAt: new Date().toISOString(), data };
  if (!fileId)
    fileId = await createDriveFile(
      token,
      { name: BACKUP_NAME, mimeType: "application/json", parents: [folderId] },
      payload,
    );
  else await updateDriveFile(token, fileId, payload);

  try {
    await driveRequest(
      token,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=true`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "user", role: "reader", emailAddress: VIEWER_EMAIL }),
      },
    );
  } catch (error) {
    if (!String(error).includes("already")) console.warn(error);
  }
  await updateDailyBackup(token, folderId, data);
  return { fileId, folderId };
}

export async function getExistingOwnerBackup(token: string) {
  const fileId = await findFile(token, BACKUP_NAME, "application/json");
  if (!fileId) return null;
  return { fileId, data: await downloadBackup(token, fileId) };
}

export async function uploadOwnerBackup(
  token: string,
  fileId: string,
  folderId: string,
  data: unknown,
) {
  const payload = { format: "clarte-ear-backup-v1", updatedAt: new Date().toISOString(), data };
  await updateDriveFile(token, fileId, payload);
  await updateDailyBackup(token, folderId, data);
}

async function updateDailyBackup(token: string, folderId: string, data: unknown) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date()),
    name = `Clarté Ear 每日備份 ${date}.json`,
    payload = { format: "clarte-ear-backup-v1", updatedAt: new Date().toISOString(), data };
  let fileId = await findFile(token, name, "application/json");
  if (!fileId)
    fileId = await createDriveFile(
      token,
      { name, mimeType: "application/json", parents: [folderId] },
      payload,
    );
  else await updateDriveFile(token, fileId, payload);
}

export async function downloadBackup(token: string, fileId: string) {
  const response = await driveRequest(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  const body = await response.json();
  return body?.data || body;
}

export async function pickBackupFile(token: string): Promise<string> {
  await loadScript("https://apis.google.com/js/api.js", "google-api");
  const gapi = (window as GoogleWindow).gapi;
  await new Promise<void>((resolve) => gapi.load("picker", { callback: resolve }));
  const google = (window as GoogleWindow).google;
  return new Promise((resolve, reject) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes("application/json")
      .setIncludeFolders(false);
    const picker = new google.picker.PickerBuilder()
      .setAppId(APP_ID)
      .setDeveloperKey(API_KEY)
      .setOAuthToken(token)
      .setTitle("選擇 Clarté Ear 資料備份")
      .addView(view)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED)
          resolve(String(data.docs?.[0]?.id || ""));
        else if (data.action === google.picker.Action.CANCEL) reject(new Error("尚未選擇備份檔"));
      })
      .build();
    picker.setVisible(true);
  });
}

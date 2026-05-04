import type { Database } from '@cico/db'
import { loadToken, saveToken } from '../../lib/oauth-store.js'
import { refreshGoogleToken } from '../../oauth/google.js'

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'

export class GoogleAuthError extends Error {}
export class GoogleNotConnectedError extends Error {
  constructor() {
    super('google is not connected')
  }
}

export type GoogleOpts = { clientId: string; clientSecret: string }

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
}

async function getValidAccessToken(db: Database, opts: GoogleOpts): Promise<string> {
  const tok = await loadToken(db, 'google')
  if (!tok) throw new GoogleNotConnectedError()
  const expiresSoon = tok.expiresAt && tok.expiresAt.getTime() - Date.now() < 60_000
  if (!expiresSoon) return tok.accessToken
  if (!tok.refreshToken) return tok.accessToken
  const refreshed = await refreshGoogleToken({
    refreshToken: tok.refreshToken,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
  })
  await saveToken(db, 'google', refreshed)
  return refreshed.accessToken
}

async function driveFetch(
  db: Database,
  opts: GoogleOpts,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getValidAccessToken(db, opts)
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new GoogleAuthError('google 401')
  if (!res.ok) throw new Error(`drive ${url} failed: ${res.status} ${await res.text()}`)
  return res
}

export async function* listFolderFiles(
  db: Database,
  opts: GoogleOpts,
  folderId: string,
  modifiedAfter?: Date,
): AsyncGenerator<DriveFile> {
  let pageToken: string | undefined
  const qParts = [
    `'${folderId}' in parents`,
    'trashed = false',
    "mimeType = 'text/csv'",
  ]
  if (modifiedAfter) qParts.push(`modifiedTime > '${modifiedAfter.toISOString()}'`)
  const q = qParts.join(' and ')

  do {
    const url = new URL(DRIVE_FILES)
    url.searchParams.set('q', q)
    url.searchParams.set('fields', 'nextPageToken, files(id,name,mimeType,modifiedTime,size)')
    url.searchParams.set('orderBy', 'modifiedTime')
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await driveFetch(db, opts, url.toString())
    const json = (await res.json()) as { nextPageToken?: string; files: DriveFile[] }
    for (const f of json.files) yield f
    pageToken = json.nextPageToken
  } while (pageToken)
}

export async function downloadFile(
  db: Database,
  opts: GoogleOpts,
  fileId: string,
): Promise<string> {
  const url = `${DRIVE_FILES}/${fileId}?alt=media`
  const res = await driveFetch(db, opts, url)
  return res.text()
}

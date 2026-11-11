const base = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
let csrf = '';
export class AdminError extends Error { constructor(public status: number, message: string) { super(message); } }
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers = new Headers();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (csrf && ['POST','PUT','DELETE'].includes(method)) headers.set('X-CSRF-Token', csrf);
  const response = await fetch(`${base}/api/admin${path}`, { method, headers, credentials:'include', cache:'no-store', body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) { const data = await response.json().catch(() => null); throw new AdminError(response.status, data?.error?.message ?? 'Não foi possível concluir. Tente novamente.'); }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export async function getCsrf() { csrf = (await request<{token:string}>('/auth/csrf')).token; }
export async function session() { await request('/auth/me'); await getCsrf(); }
export async function devLogin() { await request('/auth/dev-login', 'POST'); await getCsrf(); }
export async function logout() { await request('/auth/logout','POST'); csrf = ''; }
const decode = (value:string) => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')), c => c.charCodeAt(0));
const encode = (value:ArrayBuffer | null) => value ? btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') : null;
export async function passkeyLogin() {
  const options = await request<Omit<PublicKeyCredentialRequestOptions,'challenge'|'allowCredentials'> & {challenge:string;allowCredentials?:{id:string;type:PublicKeyCredentialType;transports?:AuthenticatorTransport[]}[]}>('/auth/passkey/options','POST');
  const publicKey = { ...options, challenge:decode(options.challenge), allowCredentials:options.allowCredentials?.map(item => ({ ...item, id:decode(item.id) })) };
  const credential = await navigator.credentials.get({ publicKey }) as PublicKeyCredential | null;
  if (!credential) throw new Error('A confirmação não foi concluída. Tente novamente.');
  const response = credential.response as AuthenticatorAssertionResponse;
  await request('/auth/passkey/verify','POST',{ id:credential.id, rawId:encode(credential.rawId), type:credential.type, clientExtensionResults:credential.getClientExtensionResults(), response:{ clientDataJSON:encode(response.clientDataJSON), authenticatorData:encode(response.authenticatorData), signature:encode(response.signature), userHandle:encode(response.userHandle) } });
  await getCsrf();
}
export { request };

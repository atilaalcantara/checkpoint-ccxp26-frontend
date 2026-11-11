type CredentialDescriptorJson = {
  id: string;
  type: PublicKeyCredentialType;
  transports?: AuthenticatorTransport[];
};

type CreationOptionsJson = {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: CredentialDescriptorJson[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
  extensions?: AuthenticationExtensionsClientInputs;
};

type RequestOptionsJson = {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: CredentialDescriptorJson[];
  userVerification?: UserVerificationRequirement;
  extensions?: AuthenticationExtensionsClientInputs;
};

type AdminSession = { id: string; name: string; role: string };
type ApiErrorResponse = { error?: string | { message?: string } };

const apiBase = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
const status = element<HTMLElement>('status');

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Elemento ausente: ${id}`);
  return found as T;
}

function encodeBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const decoded = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const buffer = new ArrayBuffer(decoded.length);
  new Uint8Array(buffer).set(decoded);
  return buffer;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorResponse | null;
    const message = typeof body?.error === 'string' ? body.error : body?.error?.message;
    throw new Error(message || `Erro HTTP ${response.status}`);
  }
  return (response.status === 204 ? null : await response.json()) as T;
}

async function getCreationOptions(headers: HeadersInit, adminId: string): Promise<PublicKeyCredentialCreationOptions> {
  const raw = await request<CreationOptionsJson>('/api/admin/passkeys/register/options', {
    method: 'POST',
    headers,
    body: JSON.stringify({ adminId }),
  });
  return {
    challenge: decodeBase64Url(raw.challenge),
    rp: raw.rp,
    user: { ...raw.user, id: decodeBase64Url(raw.user.id) },
    pubKeyCredParams: raw.pubKeyCredParams,
    timeout: raw.timeout,
    excludeCredentials: raw.excludeCredentials?.map((credential) => ({
      ...credential,
      id: decodeBase64Url(credential.id),
    })),
    authenticatorSelection: raw.authenticatorSelection,
    attestation: raw.attestation,
    extensions: raw.extensions,
  };
}

async function getRequestOptions(): Promise<PublicKeyCredentialRequestOptions> {
  const raw = await request<RequestOptionsJson>('/api/admin/auth/passkey/options', { method: 'POST' });
  return {
    challenge: decodeBase64Url(raw.challenge),
    timeout: raw.timeout,
    rpId: raw.rpId,
    allowCredentials: raw.allowCredentials?.map((credential) => ({
      ...credential,
      id: decodeBase64Url(credential.id),
    })),
    userVerification: raw.userVerification,
    extensions: raw.extensions,
  };
}

function serializeCredential(credential: PublicKeyCredential) {
  const response: Record<string, string> = {
    clientDataJSON: encodeBase64Url(credential.response.clientDataJSON),
  };
  if (credential.response instanceof AuthenticatorAttestationResponse) {
    response.attestationObject = encodeBase64Url(credential.response.attestationObject);
  } else if (credential.response instanceof AuthenticatorAssertionResponse) {
    response.authenticatorData = encodeBase64Url(credential.response.authenticatorData);
    response.signature = encodeBase64Url(credential.response.signature);
    if (credential.response.userHandle) response.userHandle = encodeBase64Url(credential.response.userHandle);
  }
  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return fallback;
  return error instanceof Error ? error.message : fallback;
}

async function loadSession(): Promise<void> {
  try {
    const user = await request<AdminSession>('/api/admin/auth/me');
    element('session').classList.remove('hidden');
    element('login').classList.add('hidden');
    element('setup').classList.add('hidden');
    element('who').textContent = `Administrador: ${user.name}`;
    element('details').textContent = `ID ${user.id} · Permissão ${user.role}`;
  } catch {
    element('session').classList.add('hidden');
    element('login').classList.remove('hidden');
  }
}

async function initialize(): Promise<void> {
  try {
    if (!window.isSecureContext || !('PublicKeyCredential' in window) || !navigator.credentials) {
      throw new Error('Este navegador não oferece suporte a Passkeys/WebAuthn neste contexto.');
    }
    const bootstrap = await request<{ enabled: boolean }>('/api/admin/auth/bootstrap-status');
    if (bootstrap.enabled) element('setup').classList.remove('hidden');
    await loadSession();
  } catch (error) {
    status.textContent = errorMessage(error, 'Não foi possível conectar ao serviço.');
  }
}

element<HTMLButtonElement>('register').addEventListener('click', async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  const secret = element<HTMLInputElement>('bootstrap').value;
  button.disabled = true;
  try {
    const headers = new Headers({ 'X-Bootstrap-Secret': secret, 'Content-Type': 'application/json' });
    const options = await getCreationOptions(headers, element<HTMLSelectElement>('admin').value);
    const credential = await navigator.credentials.create({ publicKey: options });
    if (!(credential instanceof PublicKeyCredential)) throw new Error('O autenticador não retornou uma Passkey.');
    await request('/api/admin/passkeys/register/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify(serializeCredential(credential)),
    });
    element<HTMLInputElement>('bootstrap').value = '';
    status.textContent = 'Passkey cadastrada com sucesso.';
    await initialize();
  } catch (error) {
    status.textContent = errorMessage(error, 'Operação cancelada ou expirada.');
  } finally {
    button.disabled = false;
  }
});

element<HTMLButtonElement>('loginButton').addEventListener('click', async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  try {
    const options = await getRequestOptions();
    const credential = await navigator.credentials.get({ publicKey: options });
    if (!(credential instanceof PublicKeyCredential)) throw new Error('Nenhuma Passkey foi selecionada.');
    await request('/api/admin/auth/passkey/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializeCredential(credential)),
    });
    status.textContent = 'Login realizado.';
    await loadSession();
  } catch (error) {
    status.textContent = errorMessage(error, 'Passkey não encontrada, operação cancelada ou expirada.');
  } finally {
    button.disabled = false;
  }
});

element<HTMLButtonElement>('test').addEventListener('click', async () => {
  try {
    const user = await request<AdminSession>('/api/admin/auth/me');
    status.textContent = `Cookie confirmado: sessão ativa para ${user.name}.`;
  } catch (error) {
    status.textContent = `Sessão inválida ou expirada: ${errorMessage(error, 'tente novamente')}`;
    await loadSession();
  }
});

element<HTMLButtonElement>('logout').addEventListener('click', async () => {
  try {
    const csrf = await request<{ token: string }>('/api/admin/auth/csrf');
    await request('/api/admin/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf.token } });
    status.textContent = 'Sessão encerrada.';
    await loadSession();
  } catch (error) {
    status.textContent = errorMessage(error, 'Não foi possível encerrar a sessão.');
  }
});

void initialize();

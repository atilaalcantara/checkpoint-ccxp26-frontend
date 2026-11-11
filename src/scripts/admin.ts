import { request, session, passkeyLogin, devLogin, logout, AdminError } from './admin-api';
type Poll = { id: string; question: string; a: string; b: string; active: boolean; assigned?: boolean };
type Photo = { id: string; src: string; date: string };
type Status = 'live' | 'before' | 'paused' | 'ended';

const root = document.querySelector<HTMLElement>('[data-admin]')!;
const login = root.querySelector<HTMLElement>('[data-login]')!;
const workspace = root.querySelector<HTMLElement>('[data-workspace]')!;
const content = root.querySelector<HTMLElement>('[data-content]')!;
const dialog = root.querySelector<HTMLDialogElement>('[data-dialog]')!;
const dialogContent = root.querySelector<HTMLElement>('[data-dialog-content]')!;
const toast = root.querySelector<HTMLElement>('[data-toast]')!;
const state: { polls: Poll[]; photos: Photo[]; status: Status; page: number; hasNext: boolean } = { polls:[], photos:[], status:'live', page:1, hasNext:false };
const labels: Record<Status,string> = { live:'No ar', before:'Antes do evento', paused:'Pausado', ended:'Encerrado' };
let tab: 'polls' | 'photos' = 'polls';
let filter: 'all' | 'active' | 'inactive' = 'all';
let editing: string | null = null;
let formActive = true;
let editDraft: Poll | null = null;
let returnFocus: HTMLElement | null = null;
let toastTimer: ReturnType<typeof setTimeout>;
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const icon = (name: 'edit' | 'trash') => name === 'edit'
  ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 20 4-.8L19 8.2a2.1 2.1 0 0 0-3-3L5 16.2 4 20ZM14.5 6.7l3 3"/></svg>'
  : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>';

async function load() {
  const base = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');
  const statusResponse = await fetch(`${base}/api/v1/site-status`, {cache:'no-store'});
  if (!statusResponse.ok) throw new Error('Não foi possível consultar o estado do site.');
  state.status = (await statusResponse.json()).status as Status;
  if (tab === 'polls') state.polls = (await request<{polls:Poll[]}>('/polls')).polls;
  else { const result = await request<{photos:{id:string;image:string;createdAtUtc:string}[];hasNext:boolean}>(`/photos?page=${state.page}`); state.photos = result.photos.map(p => ({id:p.id,src:`data:image/avif;base64,${p.image}`,date:new Date(p.createdAtUtc).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})})); state.hasNext=result.hasNext; }
  render();
}
function handleError(error: unknown) { if (error instanceof AdminError && error.status === 401) { workspace.hidden=true; login.hidden=false; root.querySelector<HTMLElement>('[data-login-status]')!.textContent='Sessão encerrada. Entre novamente.'; } else notify(error instanceof Error ? error.message : 'Não foi possível concluir.'); }
function notify(message: string) { clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show'); toastTimer = setTimeout(() => toast.classList.remove('show'), 2500); }
function updateStatus() {
  root.querySelector<HTMLElement>('[data-paused]')!.hidden = state.status === 'live';
  root.querySelector<HTMLElement>('[data-banner-label]')!.textContent = labels[state.status];
  root.querySelector<HTMLElement>('[data-status-label]')!.textContent = labels[state.status];
  root.querySelector('[data-site-switch]')!.classList.toggle('on', state.status === 'live');
  root.querySelector('[data-action="site"]')!.classList.toggle('is-paused', state.status !== 'live');
}
function render() {
  updateStatus();
  root.querySelectorAll<HTMLButtonElement>('[data-action="tab"]').forEach(button => {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  if (tab === 'polls') {
    const active = state.polls.filter(p => p.active).length;
    const visible = state.polls.filter(p => filter === 'all' || p.active === (filter === 'active'));
    content.innerHTML = `<div class="section-heading"><img class="section-icon pixel" src="${root.dataset.poll}" alt=""><div><h1>Enquetes</h1><p>${active} ativa${active === 1 ? '' : 's'} · ${state.polls.length - active} pausada${state.polls.length - active === 1 ? '' : 's'}</p></div></div>
      <button class="primary new-poll" type="button" data-action="new"><span aria-hidden="true">+</span>Nova enquete</button>
      <div class="filters" aria-label="Filtrar enquetes">${([['all','Todas'],['active','Ativas'],['inactive','Pausadas']] as const).map(([value, label]) => `<button type="button" data-action="filter" data-filter="${value}" aria-pressed="${filter === value}">${label}</button>`).join('')}</div>
      <div class="poll-list">${visible.length ? visible.map(p => `<article class="poll-row ${p.active ? '' : 'inactive'}"><button class="toggle" type="button" role="switch" aria-checked="${p.active}" aria-label="${p.active ? 'Pausar' : 'Ativar'} enquete ${escape(p.question)}" data-action="toggle" data-id="${p.id}"><span class="switch ${p.active ? 'on' : ''}" aria-hidden="true"></span></button><div class="poll-copy"><strong>${escape(p.question)}</strong><small>${escape(p.a)} · ${escape(p.b)}</small></div><button class="icon-button" type="button" data-action="edit" data-id="${p.id}" aria-label="Editar ${escape(p.question)}">${icon('edit')}</button></article>`).join('') : '<p class="empty">Nenhuma enquete por aqui ainda.</p>'}</div>`;
  } else {
    content.innerHTML = `<div class="section-heading"><img class="section-icon pixel" src="${root.dataset.camera}" alt=""><div><h1>Fotos</h1><p>Página ${state.page}</p></div></div><div class="photo-grid">${state.photos.map(p => `<article class="photo-card"><div class="photo-image"><img src="${p.src}" alt="Foto enviada por visitante" loading="lazy"><button class="photo-delete" type="button" data-action="delete-photo" data-id="${p.id}" aria-label="Excluir foto de ${p.date}">${icon('trash')}</button></div><p>${p.date}</p></article>`).join('')}</div>${state.photos.length ? '' : '<p class="empty">Nenhuma foto por aqui ainda.</p>'}<div class="dialog-actions"><button class="secondary" data-action="previous" ${state.page <= 1 ? 'disabled' : ''}>Anterior</button><button class="secondary" data-action="next" ${state.hasNext ? '' : 'disabled'}>Próxima</button></div>`;
  }
}
function openDialog(html: string) {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialogContent.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() { if (dialog.open) dialog.close(); }
dialog.addEventListener('close', () => { returnFocus?.focus(); });
dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
function pollForm(poll?: Poll) {
  editing = poll?.id ?? null;
  formActive = poll?.active ?? true;
  const field = (name: 'question' | 'a' | 'b', label: string, placeholder: string, max: number) => `<label class="field"><span class="field-label">${label}</span><span class="input-wrap"><input name="${name}" maxlength="${max}" placeholder="${placeholder}" value="${escape(poll?.[name] ?? '')}" required autocomplete="off"><span class="counter" data-count="${name}">0/${max}</span></span></label>`;
  openDialog(`<div class="handle" aria-hidden="true"></div><div class="dialog-head"><h2 id="dialog-title">${poll ? 'Editar enquete' : 'Nova enquete'}</h2><button class="icon-button dialog-close" type="button" data-action="close" aria-label="Fechar">×</button></div><form data-form novalidate>${field('question','Pergunta','Escreva a pergunta',60)}${field('a','Opção A','Ex.: Harry Potter',24)}${field('b','Opção B','Ex.: Arthur Morgan',24)}<div class="preview"><p class="preview-label">PRÉVIA</p><strong data-preview-question>Sua pergunta aparece aqui</strong><div class="preview-options"><span data-preview-a>Opção A</span><span data-preview-b>Opção B</span></div></div><div class="active-row"><span>Ativa</span><button class="toggle" type="button" role="switch" aria-checked="${formActive}" aria-label="Enquete ativa" data-action="form-active"><span class="switch ${formActive ? 'on' : ''}"></span></button></div><p class="form-status" role="status" data-form-status>${poll?.assigned ? 'Enquete já atribuída: apenas o status pode ser alterado.' : ''}</p><div class="dialog-actions">${poll && !poll.assigned ? '<button class="secondary delete-outline" type="button" data-action="delete-poll">Excluir</button>' : '<button class="secondary" type="button" data-action="close">Cancelar</button>'}<button class="primary" type="submit">${poll ? 'Salvar' : 'Criar enquete'}</button></div></form>`);
  if (poll?.assigned) dialog.querySelectorAll<HTMLInputElement>('input').forEach(input => input.readOnly = true);
  updateForm();
  dialog.querySelector<HTMLInputElement>('input')?.focus();
}
function updateForm() {
  const form = dialog.querySelector<HTMLFormElement>('[data-form]'); if (!form) return;
  for (const name of ['question', 'a', 'b']) {
    const input = form.elements.namedItem(name) as HTMLInputElement;
    const counter = form.querySelector<HTMLElement>(`[data-count="${name}"]`)!;
    counter.textContent = `${input.value.length}/${input.maxLength}`;
    counter.classList.toggle('near', input.value.length >= input.maxLength * .9);
    counter.classList.toggle('limit', input.value.length >= input.maxLength);
    form.querySelector<HTMLElement>(`[data-preview-${name}]`)!.textContent = input.value.trim() || ({ question: 'Sua pergunta aparece aqui', a: 'Opção A', b: 'Opção B' } as Record<string,string>)[name];
  }
}
function confirm(kind: 'poll' | 'photo' | 'site', id?: string) {
  const photo = state.photos.find(item => item.id === id);
  const art = kind === 'poll' ? root.dataset.poll : kind === 'site' ? root.dataset.korok : photo?.src;
  const title = kind === 'poll' ? 'Excluir enquete?' : kind === 'site' ? 'Pausar o site?' : 'Excluir foto?';
  const description = kind === 'poll' ? 'Os votos também somem.' : kind === 'site' ? 'Visitantes veem “Voltamos já”.' : 'Não dá para desfazer.';
  openDialog(`<div class="handle" aria-hidden="true"></div><div class="confirm"><img class="confirm-art ${kind === 'photo' ? '' : 'pixel'}" src="${art}" alt=""><h2 id="dialog-title">${title}</h2><p>${description}</p><div class="dialog-actions"><button class="secondary" type="button" data-action="${kind === 'poll' ? 'back-edit' : 'close'}">Cancelar</button><button class="${kind === 'site' ? 'primary' : 'danger'}" type="button" data-action="confirm-${kind}" data-id="${id ?? ''}">${kind === 'site' ? 'Pausar' : 'Excluir'}</button></div></div>`);
}
root.addEventListener('input', event => { if ((event.target as HTMLElement).closest('[data-form]')) updateForm(); });
root.addEventListener('paste', event => {
  const input = event.target;
  if (input instanceof HTMLInputElement && input.maxLength > 0 && (event.clipboardData?.getData('text').length ?? 0) > input.maxLength - (input.value.length - ((input.selectionEnd ?? 0) - (input.selectionStart ?? 0)))) {
    const status = dialog.querySelector<HTMLElement>('[data-form-status]'); if (status) status.textContent = 'Cortamos o excedente.';
  }
});
root.addEventListener('submit', async event => {
  const form = event.target; if (!(form instanceof HTMLFormElement) || !form.matches('[data-form]')) return;
  event.preventDefault();
  const data = new FormData(form);
  const normalize = (name: string) => String(data.get(name) ?? '').trim().replace(/\s+/g, ' ');
  const question = normalize('question'), a = normalize('a'), b = normalize('b');
  let error = '';
  if (!question || !a || !b) error = 'Preencha a pergunta e as duas opções.';
  else if ([question, a, b].some(value => value.split(' ').some(word => Array.from(word).length > 14))) error = 'Use palavras de até 14 caracteres.';
  else if (a.toLocaleLowerCase('pt-BR') === b.toLocaleLowerCase('pt-BR')) error = 'As duas opções precisam ser diferentes.';
  if (error) { form.querySelector<HTMLElement>('[data-form-status]')!.textContent = error; return; }
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  if (submit.disabled) return;
  submit.disabled = true;
  try { await request(editing ? `/polls/${editing}` : '/polls', editing ? 'PUT' : 'POST', { question, a, b, active:formActive }); closeDialog(); await load(); notify(editing ? 'Enquete salva' : 'Enquete criada'); } catch (error) { form.querySelector<HTMLElement>('[data-form-status]')!.textContent = error instanceof Error ? error.message : 'Não foi possível salvar.'; } finally { submit.disabled = false; }
});
root.addEventListener('click', async event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]'); if (!button) return;
  const action = button.dataset.action, id = button.dataset.id;
  try {
  if (action === 'login' || action === 'dev-login') { button.disabled = true; try { if (action === 'login') await passkeyLogin(); else await devLogin(); await load(); login.hidden = true; workspace.hidden = false; } finally { button.disabled = false; } }
  else if (action === 'logout') { await logout(); workspace.hidden = true; login.hidden = false; root.querySelector<HTMLButtonElement>('[data-action="login"]')?.focus(); }
  else if (action === 'tab') { tab = button.dataset.tab === 'photos' ? 'photos' : 'polls'; state.page=1; await load(); }
  else if (action === 'previous' || action === 'next') { state.page += action === 'next' ? 1 : -1; await load(); }
  else if (action === 'filter') { filter = button.dataset.filter as typeof filter; render(); }
  else if (action === 'new') pollForm();
  else if (action === 'edit') { const poll = state.polls.find(p => p.id === id); if (poll) pollForm(poll); }
  else if (action === 'toggle') { const poll = state.polls.find(p => p.id === id); if (poll) { await request(`/polls/${id}`,'PUT',{...poll,active:!poll.active}); await load(); notify(poll.active ? 'Enquete pausada' : 'Enquete ativada'); } }
  else if (action === 'form-active') { formActive = !formActive; button.setAttribute('aria-checked', String(formActive)); button.querySelector('.switch')?.classList.toggle('on', formActive); }
  else if (action === 'close') closeDialog();
  else if (action === 'delete-poll') {
    const form = dialog.querySelector<HTMLFormElement>('[data-form]');
    if (form && editing) { const data = new FormData(form); editDraft = { id: editing, question: String(data.get('question') ?? ''), a: String(data.get('a') ?? ''), b: String(data.get('b') ?? ''), active: formActive }; }
    confirm('poll', editing ?? undefined);
  }
  else if (action === 'back-edit') { const poll = editDraft ?? state.polls.find(p => p.id === editing); if (poll) pollForm(poll); editDraft = null; }
  else if (action === 'confirm-poll') { await request(`/polls/${editing}`,'DELETE'); closeDialog(); await load(); notify('Enquete excluída'); }
  else if (action === 'delete-photo') confirm('photo', id);
  else if (action === 'confirm-photo') { await request(`/photos/${id}`,'DELETE'); closeDialog(); await load(); notify('Foto excluída'); }
  else if (action === 'site') { openDialog(`<div class="handle"></div><div class="confirm"><h2 id="dialog-title">Estado do site</h2><p>Escolha o que os visitantes vão ver.</p>${(Object.keys(labels) as Status[]).map(s => `<button class="secondary status-choice" data-action="set-status" data-status="${s}">${labels[s]}${state.status === s ? ' · atual' : ''}</button>`).join('')}<button class="secondary status-choice" data-action="close">Cancelar</button></div>`); }
  else if (action === 'resume' || action === 'set-status') { const status = action === 'resume' ? 'live' : button.dataset.status as Status; if (status === state.status) { closeDialog(); return; } openDialog(`<div class="handle"></div><div class="confirm"><h2 id="dialog-title">Alterar estado?</h2><p>O site ficará em: ${labels[status]}.</p><div class="dialog-actions"><button class="secondary" data-action="close">Cancelar</button><button class="primary" data-action="confirm-status" data-status="${status}">Confirmar</button></div></div>`); }
  else if (action === 'confirm-status') { await request('/site-status','PUT',{status:button.dataset.status}); closeDialog(); await load(); notify('Estado atualizado'); }
  } catch (error) { if (action === 'login' || action === 'dev-login') root.querySelector<HTMLElement>('[data-login-status]')!.textContent = error instanceof Error ? error.message : 'Não foi possível entrar.'; else handleError(error); }
});
void session().then(async () => { await load(); login.hidden=true; workspace.hidden=false; }).catch(() => {});

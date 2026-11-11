import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = (await readFile(new URL('../src/scripts/site-status.ts', import.meta.url), 'utf8'))
  .replace("import.meta.env.PUBLIC_API_URL", "''");
const code = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });

async function setup(initial) {
  let response = initial;
  const events = {};
  const buttons = [];
  const panels = Object.fromEntries(['loading', 'before', 'paused', 'ended', 'error'].map(name => {
    const image = { dataset: { siteImage: `/${name}.avif` }, hasAttribute: () => false };
    const button = { addEventListener: (_, fn) => buttons.push(fn) };
    return [name, { dataset: { sitePanel: name }, hidden: name !== 'loading', image, button,
      querySelector: () => image }];
  }));
  const content = { inert: true, contains: () => false };
  const gate = { hidden: false, contains: () => false,
    querySelectorAll: selector => selector === '[data-site-panel]' ? Object.values(panels) : [panels.paused.button, panels.error.button],
    querySelector: () => null };
  const document = { hidden: false, activeElement: null,
    querySelector: selector => selector === '[data-site-gate]' ? gate : content,
    addEventListener: (name, fn) => { events[name] = fn; } };
  const window = { addEventListener: (name, fn) => { events[name] = fn; } };
  let reloads = 0;
  const context = { document, window, exports: {}, AbortSignal, setTimeout: () => 1, clearTimeout: () => {},
    location: { reload: () => { reloads++; } },
    fetch: async () => { if (response instanceof Error) throw response; return { ok: true, json: async () => ({ status: response }) }; } };
  vm.runInNewContext(code, context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  return { panels, content, gate, buttons, events, settle, setResponse: value => { response = value; }, reloads: () => reloads };
}

test('estados públicos exibem a tela correta e recuperam o site ao voltar para live', async () => {
  const app = await setup('before');
  assert.equal(app.panels.before.hidden, false);
  assert.equal(app.content.inert, true);
  assert.equal(app.panels.before.image.src, '/before.avif');
  app.setResponse('paused'); app.events['checkpoint:site-status'](); await app.settle();
  assert.equal(app.panels.before.hidden, true);
  assert.equal(app.panels.paused.hidden, false);
  app.setResponse('ended'); app.buttons[0](); await app.settle();
  assert.equal(app.panels.ended.hidden, false);
  app.setResponse('live'); app.events.online(); await app.settle();
  assert.equal(app.reloads(), 1);
});

test('erro inicial oferece nova tentativa; falha posterior preserva estado confirmado', async () => {
  const app = await setup(new Error('offline'));
  assert.equal(app.panels.error.hidden, false);
  app.setResponse('paused'); app.buttons[1](); await app.settle();
  assert.equal(app.panels.paused.hidden, false);
  app.setResponse(new Error('offline')); app.events.online(); await app.settle();
  assert.equal(app.panels.paused.hidden, false);
  assert.equal(app.panels.error.hidden, true);
});

test('live inicial libera a experiência', async () => {
  const app = await setup('live');
  assert.equal(app.gate.hidden, true);
  assert.equal(app.content.inert, false);
});

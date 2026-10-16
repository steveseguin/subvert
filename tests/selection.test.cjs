const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

// Small, inert DOM fixture for the bookmarklet's selector/clone/serialization flow.
// It models selector-list document ordering, identity deduplication and contains().
// It does not model a browser's CSS, layout, navigation, CSP or event dispatch.
function element(tag, attrs = {}, children = [], text = '') {
  return {
    tag, attrs, children, text,
    get outerHTML() {
      return `<${tag}${Object.entries(attrs).map(([k,v]) => ` ${k}="${v}"`).join('')}>${text}${children.map(c => c.outerHTML).join('')}</${tag}>`;
    },
    cloneNode() { return element(tag, {...attrs}, children.map(c => c.cloneNode(true)), text); },
    contains(other) { return this === other || children.some(c => c.contains(other)); },
    getElementsByTagName(t) { return children.flatMap(c => [...(c.tag === t ? [c] : []), ...c.getElementsByTagName(t)]); },
  };
}
function matches(n, selector) {
  if (selector === '[role="main"]') return n.attrs.role === 'main';
  if (selector[0] === '.') return (n.attrs.class || '').split(/\s+/).includes(selector.slice(1));
  if (selector[0] === '#') return n.attrs.id === selector.slice(1);
  return n.tag === selector;
}
const sourcePath = process.env.SUBVERT_SOURCE || path.join(__dirname, '..', 'index.html');
const source = fs.readFileSync(sourcePath, 'utf8');
const bookmarklet = source.match(/href="javascript:([^"]+)"/)[1];
function run(roots) {
  const flatten = n => [n, ...n.children.flatMap(flatten)];
  const all = roots.flatMap(flatten);
  const body = {innerHTML: roots.map(n => n.outerHTML).join('')};
  const document = {
    body,
    querySelectorAll(s) { return all.filter(n => s.split(',').some(selector => matches(n, selector))); },
    getElementById() { return {addEventListener() {}}; },
  };
  vm.runInNewContext(bookmarklet, {document, alert() { throw new Error('Unexpected missing content'); }});
  return body.innerHTML;
}
function once(output, marker = 'ARTICLE_MARKER') {
  assert.equal(output.split(marker).length - 1, 1, `${marker} must occur once`);
}
const article = (attrs = {}, text = 'ARTICLE_MARKER') => element('article', attrs, [], text);
test('actual bookmarklet parses', () => { new vm.Script(bookmarklet); });
test('single article remains intact', () => { once(run([article()])); });
test('one article matching multiple selectors appears once', () => {
  once(run([article({class:'content article-content post-content', role:'main', id:'content'})]));
});
test('ordinary main > article nesting appears once', () => {
  once(run([element('main', {}, [article()])]));
});
test('main landmark and article content classes do not multiply text', () => {
  once(run([element('main', {role:'main'}, [article({class:'content'})])]));
});
test('deep selected nesting preserves surrounding content once', () => {
  const root = element('main', {}, [element('div', {id:'content'}, [article({class:'post-content'})], 'INTRO_MARKER')]);
  const output = run([root]);
  once(output); once(output, 'INTRO_MARKER');
  assert.ok(output.includes(root.outerHTML));
});
test('disjoint articles remain once each in document order', () => {
  const output = run([article({}, 'FIRST_MARKER'), article({}, 'SECOND_MARKER')]);
  once(output, 'FIRST_MARKER'); once(output, 'SECOND_MARKER');
  assert.ok(output.indexOf('FIRST_MARKER') < output.indexOf('SECOND_MARKER'));
});
test('disjoint mixed selectors retain document order instead of selector priority', () => {
  const output = run([element('main', {}, [], 'FIRST_MARKER'), article({}, 'SECOND_MARKER'), element('div', {class:'content'}, [], 'THIRD_MARKER')]);
  ['FIRST_MARKER', 'SECOND_MARKER', 'THIRD_MARKER'].forEach(m => once(output, m));
  assert.ok(output.indexOf('FIRST_MARKER') < output.indexOf('SECOND_MARKER'));
  assert.ok(output.indexOf('SECOND_MARKER') < output.indexOf('THIRD_MARKER'));
});
test('two disjoint nested article regions are both preserved once', () => {
  const roots = [element('main', {}, [article({}, 'FIRST_MARKER')]), element('section', {class:'content'}, [article({}, 'SECOND_MARKER')])];
  const output = run(roots);
  once(output, 'FIRST_MARKER'); once(output, 'SECOND_MARKER');
  assert.ok(output.indexOf('FIRST_MARKER') < output.indexOf('SECOND_MARKER'));
});

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync(process.env.SUBVERT_SOURCE || path.join(__dirname, '../index.html'), 'utf8');
const bookmarklet = source.match(/href="javascript:([^"]+)"/)[1];
// Constrained API fixture, not a browser: body.innerHTML replacement cannot
// remove head children; appendChild inserts a new clone; querySelectorAll
// discovers the current head children afresh at each activation.
function page(withBodyStyles = false) {
  const head = { children: [], appendChild(n) { n.parentElement = this; this.children.push(n); return n; } };
  function style(tagName) { return { tagName, parentElement: null, cloneNode() { return style(tagName); } }; }
  head.appendChild({ tagName: 'META' }); head.appendChild(style('STYLE')); head.appendChild({ tagName: 'SCRIPT' }); head.appendChild(style('LINK')); head.appendChild({ tagName: 'TITLE' });
  const originalHead = head.children.slice();
  const content = '<main role="main"><article class="content"><p>Nested article</p></article></main>';
  const original = withBodyStyles ? '<style id="body-first">p{color:red}</style>' + content + '<section><style id="nested">p{color:blue}</style></section><link rel="stylesheet" href="local.css">' : content;
  let html = original;
  let bodyStyles = [];
  const body = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      // These two fixed, valid fixture shapes are known, not a general parser.
      // innerHTML recreates body descendants; old nested parents detach.
      bodyStyles = value === original && withBodyStyles ? [
        serializedStyle('<style id="body-first">p{color:red}</style>', body),
        serializedStyle('<style id="nested">p{color:blue}</style>', { appendChild() {} }),
        serializedStyle('<link rel="stylesheet" href="local.css">', body),
      ] : [];
    },
    appendChild(node) { html += node.outerHTML; bodyStyles.push(node); node.parentElement = body; return node; },
  };
  function serializedStyle(outerHTML, parentElement) { return { outerHTML, parentElement, cloneNode() { return serializedStyle(outerHTML, null); } }; }
  body.innerHTML = original;
  const article = { contains(other) { return this === other; }, cloneNode() { return { outerHTML: '<article class="content"><p>Nested article</p></article>', getElementsByTagName() { return []; } }; } };
  const main = { contains(other) { return other === this || other === article; }, cloneNode() { return { outerHTML: content, getElementsByTagName() { return []; } }; } };
  let restore;
  const document = { body, querySelectorAll(selector) { return selector === 'style,link[rel="stylesheet"]' ? [...head.children.filter(n => n.tagName === 'STYLE' || n.tagName === 'LINK'), ...bodyStyles] : [main, article]; }, getElementById() { return { addEventListener(event, callback) { assert.equal(event, 'click'); restore = callback; } }; } };
  const context = vm.createContext({ document, alert() { throw Error('Unexpected no content'); } });
  return { head, originalHead, cycle() { vm.runInContext(bookmarklet, context); assert.equal(body.innerHTML.split('Nested article').length - 1, 1); restore(); assert.equal(body.innerHTML, original); } };
}
test('ten nested-content clean/restore cycles preserve head stylesheet count and identities', () => {
  const p = page();
  const counts = [p.head.children.length];
  for (let i = 0; i < 10; i++) { p.cycle(); counts.push(p.head.children.length); }
  assert.deepEqual(counts, Array(11).fill(5));
  assert.deepEqual(p.head.children, p.originalHead);
});

test('body-level and nested stylesheet markup/order survives repeated restoration without extra nodes', () => {
  const p = page(true);
  for (let i = 0; i < 3; i++) p.cycle();
  assert.deepEqual(p.head.children, p.originalHead);
});

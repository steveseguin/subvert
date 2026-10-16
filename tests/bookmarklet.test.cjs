const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Execute the actual bookmarklet. The small DOM fixture provides only the APIs
// used by this flow; it is not browser, CSS, CSP, or content-detection coverage.
const sourcePath = process.env.SUBVERT_SOURCE || path.join(__dirname, '..', 'index.html');
const page = fs.readFileSync(sourcePath, 'utf8');
const bookmarklet = page.match(/href="(javascript:[^"]+)"/)[1].replace(/^javascript:/, '');

function makeArticle(outerHTML = '<article><p>Article body</p></article>') {
    return {
        contains(other) { return this === other; },
        cloneNode() {
            return { outerHTML, getElementsByTagName() { return []; } };
        },
    };
}

function fixture(original = '<article><p>Original article</p></article><nav>Menu</nav>', options = {}) {
    const alerts = [];
    const registered = new Map();
    const styleParent = { appended: [], appendChild(style) { this.appended.push(style); } };
    const styles = options.withStyles ? [{ cloneNode() { return { tagName: 'STYLE' }; }, parentElement: styleParent }] : [];
    const body = { innerHTML: original, children: [], offsetWidth: 800, offsetHeight: 600, innerText: '', getElementsByTagName() { return []; } };
    const document = {
        body,
        querySelectorAll(selector) {
            if (selector === 'style,link[rel="stylesheet"]') return styles;
            return selector.split(',').includes('article') ? (options.articles || [makeArticle()]) : [];
        },
        getElementById(id) {
            assert.match(body.innerHTML, new RegExp('id="' + id + '"'));
            return { addEventListener(event, callback) { registered.set(id + ':' + event, callback); } };
        },
    };
    const context = vm.createContext({ document, alert(message) { alerts.push(message); } });
    function activate() { registered.clear(); vm.runInContext(bookmarklet, context); }
    function restore() {
        const listener = registered.get('clean-restore:click');
        if (listener) return listener();
        // Inline event handlers execute without the bookmarklet IIFE's lexical
        // environment, as in a browser. Keep this path so the baseline fails.
        const inline = body.innerHTML.match(/<button onclick="([^"]+)"[^>]*>Restore<\/button>/);
        assert.ok(inline, 'Restore control exists');
        return vm.runInContext(inline[1], context);
    }
    return { original, body, context, alerts, styleParent, activate, restore };
}

test('Restore recovers the exact original page after Clean View', () => {
    const f = fixture();
    f.activate();
    assert.notEqual(f.body.innerHTML, f.original);
    assert.match(f.body.innerHTML, /id="clean-view"/);
    f.restore();
    assert.equal(f.body.innerHTML, f.original);
});

test('Restore retains access to original style state', () => {
    const f = fixture(undefined, { withStyles: true });
    f.activate();
    f.restore();
    assert.equal(f.body.innerHTML, f.original);
    assert.equal(f.styleParent.appended.length, 1);
});

test('multiple selected articles still restore the original body', () => {
    const f = fixture(undefined, { articles: [makeArticle(), makeArticle('<article>Second article</article>')] });
    f.activate();
    assert.match(f.body.innerHTML, /Second article/);
    f.restore();
    assert.equal(f.body.innerHTML, f.original);
});

test('clean and restore can repeat without losing the original body', () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) { f.activate(); f.restore(); assert.equal(f.body.innerHTML, f.original); }
});

test('later activation captures the current body instead of a previous snapshot', () => {
    const f = fixture();
    f.activate(); f.restore();
    f.body.innerHTML = '<article>New page state</article>';
    f.activate(); f.restore();
    assert.equal(f.body.innerHTML, '<article>New page state</article>');
});

test('restoration snapshots remain independent across page contexts', () => {
    const a = fixture('<article>First page</article>');
    const b = fixture('<article>Second page</article>');
    a.activate(); b.activate(); a.restore(); b.restore();
    assert.equal(a.body.innerHTML, a.original);
    assert.equal(b.body.innerHTML, b.original);
});

test('bookmarklet does not expose private snapshot variables globally', () => {
    const f = fixture();
    f.activate();
    assert.equal(vm.runInContext('typeof originalContent', f.context), 'undefined');
    assert.equal(vm.runInContext('typeof originalStyles', f.context), 'undefined');
    f.restore();
    assert.equal(f.body.innerHTML, f.original);
});

test('no article leaves the original page unchanged and reports the problem', () => {
    const f = fixture(undefined, { articles: [] });
    f.activate();
    assert.equal(f.body.innerHTML, f.original);
    assert.equal(f.alerts.length, 1);
});

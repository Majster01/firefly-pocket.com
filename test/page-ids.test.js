import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const page = readFileSync(new URL('../help/hetzner/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../js/form.js', import.meta.url), 'utf8');

const pageIds = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

describe('help/hetzner/index.html against js/form.js', () => {
	it('every id the script looks up exists on the page, or the page goes dead on load', () => {
		const looked = [...script.matchAll(/byId\('([^']+)'\)/g)].map((match) => match[1]);

		assert.ok(looked.length > 5);
		assert.deepEqual(looked.filter((id) => !pageIds.has(id)), []);
	});

	it('every field has its input and its error line', () => {
		const inputIds = [...script.matchAll(/INPUT_IDS = \{([^}]*)\}/g)][0][1].matchAll(/(\w+): '([^']+)'/g);

		for (const [, field, inputId] of inputIds) {
			assert.ok(pageIds.has(inputId), `no input #${inputId}`);
			assert.ok(pageIds.has(`${field}-error`), `no error line #${field}-error`);
		}
	});

	it('the domain slots the script fills exist', () => {
		assert.match(page, /class="domain-slot"/);
	});

	it('the page allows only its own script, no inline code', () => {
		assert.match(page, /script-src 'self'/);
		assert.doesNotMatch(page, /<script(?![^>]*\bsrc=)/);
		assert.doesNotMatch(page, /\son\w+="/);
	});
});

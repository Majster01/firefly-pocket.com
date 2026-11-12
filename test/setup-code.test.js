import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	newSetupCode,
	SETUP_CODE_ALPHABET,
	SETUP_CODE_PATTERN,
	setupCodeFrom,
} from '../js/setup-code.js';

describe('setupCodeFrom', () => {
	it('all-zero bytes → the first symbol, in groups of four', () => {
		assert.equal(setupCodeFrom(new Uint8Array(16)), '0000-0000-0000-0000');
	});

	it('bytes 0..15 → the alphabet read in order, deterministic', () => {
		const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);

		assert.equal(setupCodeFrom(bytes), '0123-4567-89AB-CDEF');
	});

	it('byte 255 → the last symbol: only the low five bits count', () => {
		assert.equal(setupCodeFrom(new Uint8Array(16).fill(255)), 'ZZZZ-ZZZZ-ZZZZ-ZZZZ');
	});

	it('every byte value → a symbol of the alphabet, each used by exactly 8 byte values', () => {
		const uses = new Map();

		for (let byte = 0; byte < 256; byte += 1) {
			const symbol = setupCodeFrom(new Uint8Array(16).fill(byte))[0];

			uses.set(symbol, (uses.get(symbol) ?? 0) + 1);
		}

		assert.equal(uses.size, 32);
		assert.ok([...uses.values()].every((count) => count === 8));
	});

	it('the wrong number of bytes → throws', () => {
		assert.throws(() => setupCodeFrom(new Uint8Array(15)), RangeError);
		assert.throws(() => setupCodeFrom(new Uint8Array(17)), RangeError);
	});
});

describe('newSetupCode', () => {
	it('many draws → every one matches the pattern scripts/config.sh checks, and they differ', () => {
		const codes = new Set();

		for (let draw = 0; draw < 500; draw += 1) {
			const code = newSetupCode();

			assert.match(code, SETUP_CODE_PATTERN);
			codes.add(code);
		}

		assert.equal(codes.size, 500);
	});

	it('the alphabet → 32 symbols without I, L, O or U', () => {
		assert.equal(SETUP_CODE_ALPHABET.length, 32);
		assert.equal(new Set(SETUP_CODE_ALPHABET).size, 32);
		assert.doesNotMatch(SETUP_CODE_ALPHABET, /[ILOU]/);
	});
});

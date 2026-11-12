// Crockford's base32 without I, L, O and U: the alphabet that scripts/setup.sh
// (make_setup_code) and scripts/config.sh (setupcode) in firefly-pocket-stack accept.
export const SETUP_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SETUP_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

const SETUP_CODE_BYTES = 16;
const GROUP_LENGTH = 4;

/**
 * Sixteen random bytes become `XXXX-XXXX-XXXX-XXXX`: `byte & 31` over 32 symbols has no
 * modulo bias, and 16 symbols are 80 bits.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export const setupCodeFrom = (bytes) => {
	if (bytes.length !== SETUP_CODE_BYTES) {
		throw new RangeError(`a setup code needs ${SETUP_CODE_BYTES} random bytes, got ${bytes.length}`);
	}

	const symbols = Array.from(bytes, (byte) => SETUP_CODE_ALPHABET[byte & 31]);
	const groups = [];

	for (let start = 0; start < SETUP_CODE_BYTES; start += GROUP_LENGTH) {
		groups.push(symbols.slice(start, start + GROUP_LENGTH).join(''));
	}

	return groups.join('-');
};

/** @returns {string} */
export const newSetupCode = () => setupCodeFrom(crypto.getRandomValues(new Uint8Array(SETUP_CODE_BYTES)));

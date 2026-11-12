const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * @param {string} typed
 * @returns {boolean}
 */
export const isIpv4 = (typed) => IPV4_PATTERN.test(typed.trim());

/**
 * The one record the stack needs: a wildcard covers firefly., app., admin., import. and legal.
 * @param {{ domain: string, ip: string }} params
 * @returns {string}
 */
export const wildcardRecordFor = ({ domain, ip }) => `*.${domain}    A    ${ip.trim()}`;

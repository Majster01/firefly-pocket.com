import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isIpv4, wildcardRecordFor } from '../js/dns-record.js';

describe('isIpv4', () => {
	for (const ip of ['1.2.3.4', ' 203.0.113.42 ', '0.0.0.0', '255.255.255.255']) {
		it(`${JSON.stringify(ip)} → true`, () => assert.equal(isIpv4(ip), true));
	}

	for (const ip of ['', '1.2.3', '1.2.3.4.5', '256.1.1.1', '01.2.3.4', 'a.b.c.d', '1.2.3.4/32', '::1']) {
		it(`${JSON.stringify(ip)} → false`, () => assert.equal(isIpv4(ip), false));
	}
});

describe('wildcardRecordFor', () => {
	it('domain and ip → the one wildcard A record', () => {
		assert.equal(wildcardRecordFor({ domain: 'money.example.com', ip: ' 203.0.113.42 ' }), '*.money.example.com    A    203.0.113.42');
	});
});

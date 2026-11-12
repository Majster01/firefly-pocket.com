import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildUserData, CLONE_WITH_RETRIES, parseAnswers, REPO_URL } from '../js/user-data.js';

const SETUP_CODE = '7B2M-4QX9-C8KD-0VRZ';
const SSH_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl me@laptop';

const typed = (overrides = {}) => ({
	domain: 'money.example.com',
	email: 'me@example.com',
	timezone: 'Europe/Ljubljana',
	sshKey: '',
	...overrides,
});

const parseUserData = (userData) => {
	const [header, body, ...rest] = userData.split('\n');

	assert.equal(header, '#cloud-config');
	assert.deepEqual(rest, ['']);

	return JSON.parse(body);
};

describe('parseAnswers', () => {
	it('good answers → normalized: lower case, no trailing dot, trimmed', () => {
		const result = parseAnswers(typed({ domain: ' Money.Example.COM. ', email: ' me@example.com ' }));

		assert.deepEqual(result, {
			status: 'ok',
			answers: {
				domain: 'money.example.com',
				email: 'me@example.com',
				timezone: 'Europe/Ljubljana',
				sshKey: '',
			},
		});
	});

	for (const domain of [
		'',
		'localhost',
		'https://example.com',
		'example.com/path',
		'exa mple.com',
		'-example.com',
		'example..com',
		'exam"ple.com',
		'example.com\nruncmd: x',
		`${'a'.repeat(250)}.com`,
		`${'a'.repeat(64)}.example.com`,
		`${'a'.repeat(62)}.${'b'.repeat(62)}.${'c'.repeat(62)}.${'d'.repeat(62)}.com`,
		'money.localhost',
		'printer.local',
	]) {
		it(`domain ${JSON.stringify(domain)} → DOMAIN_INVALID`, () => {
			assert.deepEqual(parseAnswers(typed({ domain })), { status: 'rejected', field: 'domain', code: 'DOMAIN_INVALID' });
		});
	}

	for (const email of ['', 'me', 'me@', 'me@example', 'a b@example.com', 'me@example.com\nx', 'me"@example.com']) {
		it(`email ${JSON.stringify(email)} → EMAIL_INVALID`, () => {
			assert.deepEqual(parseAnswers(typed({ email })), { status: 'rejected', field: 'email', code: 'EMAIL_INVALID' });
		});
	}

	for (const timezone of ['', 'Mars/Base', 'Europe/ Ljubljana', 'Europe/', '../etc/passwd', 'Europe/Ljubljana\nx']) {
		it(`timezone ${JSON.stringify(timezone)} → TIMEZONE_UNKNOWN`, () => {
			assert.deepEqual(parseAnswers(typed({ timezone })), { status: 'rejected', field: 'timezone', code: 'TIMEZONE_UNKNOWN' });
		});
	}

	it('a zone typed in the wrong case → the zone\'s own spelling, which is the file the server looks up', () => {
		assert.equal(parseAnswers(typed({ timezone: 'europe/ljubljana' })).answers.timezone, 'Europe/Ljubljana');
	});

	for (const domain of ['xn--mnchen-3ya.de', '1password.com', 'my-money.example.com', 'a.b']) {
		it(`domain ${JSON.stringify(domain)} → accepted`, () => {
			assert.equal(parseAnswers(typed({ domain })).status, 'ok');
		});
	}

	for (const timezone of ['Asia/Kolkata', 'asia/kolkata', 'Europe/Kyiv', 'Asia/Calcutta']) {
		it(`current or older zone name ${JSON.stringify(timezone)} → accepted, in the spelling Intl gives`, () => {
			const result = parseAnswers(typed({ timezone }));

			assert.equal(result.status, 'ok');
			assert.match(result.answers.timezone, /^(Asia\/(Kolkata|Calcutta)|Europe\/(Kyiv|Kiev))$/);
		});
	}

	it('UTC and Etc/UTC → accepted', () => {
		assert.equal(parseAnswers(typed({ timezone: 'UTC' })).status, 'ok');
		assert.equal(parseAnswers(typed({ timezone: 'Etc/UTC' })).status, 'ok');
	});

	for (const sshKey of ['hunter2', 'ssh-ed25519', 'ssh-ed25519 AAAA\nssh-ed25519 BBBB', 'ssh-dss AAAA x']) {
		it(`ssh key ${JSON.stringify(sshKey)} → SSH_KEY_INVALID`, () => {
			assert.deepEqual(parseAnswers(typed({ sshKey })), { status: 'rejected', field: 'sshKey', code: 'SSH_KEY_INVALID' });
		});
	}

	it('an ssh key → accepted, empty → accepted', () => {
		assert.equal(parseAnswers(typed({ sshKey: SSH_KEY })).status, 'ok');
		assert.equal(parseAnswers(typed({ sshKey: '' })).status, 'ok');
	});

	it('the first bad answer in form order is the one named', () => {
		assert.deepEqual(parseAnswers(typed({ domain: 'x', email: 'y' })), {
			status: 'rejected',
			field: 'domain',
			code: 'DOMAIN_INVALID',
		});
	});
});

describe('buildUserData', () => {
	const answers = () => parseAnswers(typed()).answers;

	it('is cloud-config with a JSON body that parses', () => {
		const config = parseUserData(buildUserData({ answers: answers(), setupCode: SETUP_CODE }));

		assert.equal(config.package_update, true);
		assert.deepEqual(config.packages, ['ca-certificates', 'curl', 'git', 'jq']);
	});

	it('writes the four first-boot keys to a root-only file', () => {
		const config = parseUserData(buildUserData({ answers: answers(), setupCode: SETUP_CODE }));
		const [file] = config.write_files;

		assert.equal(file.path, '/etc/fireflyx/first-boot.json');
		assert.equal(file.permissions, '0600');
		assert.equal(file.owner, 'root:root');
		assert.deepEqual(JSON.parse(file.content), {
			domain: 'money.example.com',
			email: 'me@example.com',
			timezone: 'Europe/Ljubljana',
			setup_code: SETUP_CODE,
		});
	});

	it('clones the stack with retries and runs first-boot install', () => {
		const config = parseUserData(buildUserData({ answers: answers(), setupCode: SETUP_CODE }));

		assert.deepEqual(config.runcmd, [
			['sh', '-c', CLONE_WITH_RETRIES, 'clone', REPO_URL],
			['/opt/fireflyx/scripts/first-boot.sh', 'install'],
		]);
	});

	it('no ssh key → the user has none; with one → exactly that key', () => {
		const without = parseUserData(buildUserData({ answers: answers(), setupCode: SETUP_CODE }));
		const withKey = parseUserData(
			buildUserData({ answers: parseAnswers(typed({ sshKey: SSH_KEY })).answers, setupCode: SETUP_CODE }),
		);

		assert.equal('ssh_authorized_keys' in without.users[0], false);
		assert.deepEqual(withKey.users[0].ssh_authorized_keys, [SSH_KEY]);
		assert.equal(without.users[0].name, 'fireflyx');
		assert.deepEqual(without.users[0].groups, ['sudo']);
	});

	it('an ssh key comment with quotes → escaped, and read back unchanged', () => {
		const sshKey = `${SSH_KEY} "work" laptop`;
		const config = parseUserData(buildUserData({ answers: parseAnswers(typed({ sshKey })).answers, setupCode: SETUP_CODE }));

		assert.deepEqual(config.users[0].ssh_authorized_keys, [sshKey]);
	});

	it('text that looks like template or shell syntax → carried as plain data', () => {
		const hostile = { ...answers(), email: 'a+${HOME}@example.com' };
		const config = parseUserData(buildUserData({ answers: hostile, setupCode: SETUP_CODE }));

		assert.equal(JSON.parse(config.write_files[0].content).email, 'a+${HOME}@example.com');
		assert.equal(config.runcmd.length, 2);
	});

	it('something that is not a setup code → throws', () => {
		assert.throws(() => buildUserData({ answers: answers(), setupCode: 'nope' }), RangeError);
	});
});

import { SETUP_CODE_PATTERN } from './setup-code.js';

export const REPO_URL = 'https://github.com/Majster01/firefly-pocket-stack.git';

// Each answer is checked at least as strictly as scripts/config.sh checks it, so the page never
// writes one the server then refuses, which would leave a new server stuck with no way to tell.
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const SSH_KEY_PATTERN =
	/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+={0,2}( [^\p{Cc}\u2028\u2029]*)?$/u;
// "admin." goes in front, and a name is 253 characters at most.
const MAX_DOMAIN_LENGTH = 247;
// With no SSH, the web Console's login banner is where a failed clone shows: first-boot.sh, which
// writes banners itself, is not on the server yet.
export const CLONE_WITH_RETRIES =
	'for try in 1 2 3 4 5; do git clone --quiet "$1" /opt/fireflyx && exit 0; sleep 15; done; ' +
	'mkdir -p /etc/issue.d; ' +
	'echo "Firefly Pocket setup: could not download the setup scripts. Delete this server and start again." > /etc/issue.d/50-fireflyx.issue; ' +
	'exit 1';
// *.localhost is this machine to the server, so admin. would never point at it.
const LOCAL_SUFFIX = /(^|\.)(localhost|local)$/;

/**
 * @typedef {object} Answers
 * @property {string} domain
 * @property {string} email
 * @property {string} timezone
 * @property {string} sshKey Empty for a server without SSH access.
 */

/**
 * @typedef {'DOMAIN_INVALID' | 'EMAIL_INVALID' | 'TIMEZONE_UNKNOWN' | 'SSH_KEY_INVALID'} AnswerError
 */

/**
 * The zone's own spelling, or nothing: the server looks the name up as a file in
 * /usr/share/zoneinfo (tzdata-legacy there covers the older names a browser may answer with),
 * and a file name has a case. Intl throws for a name it does not know.
 * @param {string} timezone
 * @returns {string | undefined}
 */
const canonicalTimezone = (timezone) => {
	try {
		return new Intl.DateTimeFormat('en', { timeZone: timezone }).resolvedOptions().timeZone;
	} catch {
		return undefined;
	}
};

/**
 * @typedef {{ status: 'ok', answers: Answers } | { status: 'rejected', field: keyof Answers, code: AnswerError }} ParsedAnswers
 */

/**
 * Trims and normalizes what the person typed, and names the first answer that cannot be used.
 * @param {Answers} typed
 * @returns {ParsedAnswers}
 */
export const parseAnswers = (typed) => {
	const domain = typed.domain.trim().toLowerCase().replace(/\.$/, '');
	const email = typed.email.trim();
	const timezone = canonicalTimezone(typed.timezone.trim());
	const sshKey = typed.sshKey.trim();

	if (domain.length > MAX_DOMAIN_LENGTH || !DOMAIN_PATTERN.test(domain) || LOCAL_SUFFIX.test(domain)) {
		return { status: 'rejected', field: 'domain', code: 'DOMAIN_INVALID' };
	}

	if (!EMAIL_PATTERN.test(email)) {
		return { status: 'rejected', field: 'email', code: 'EMAIL_INVALID' };
	}

	if (!timezone) {
		return { status: 'rejected', field: 'timezone', code: 'TIMEZONE_UNKNOWN' };
	}

	if (sshKey && !SSH_KEY_PATTERN.test(sshKey)) {
		return { status: 'rejected', field: 'sshKey', code: 'SSH_KEY_INVALID' };
	}

	return { status: 'ok', answers: { domain, email, timezone, sshKey } };
};

/**
 * @typedef {object} UserDataParams
 * @property {Answers} answers Already through `parseAnswers`.
 * @property {string} setupCode
 */

/**
 * The cloud-init to paste into Hetzner's "Cloud config" field. The body is one line of JSON,
 * which is valid YAML, so nothing a person types can break the document. `/etc/fireflyx/first-boot.json`
 * is what scripts/first-boot.sh in firefly-pocket-stack reads; the two agree on its four keys.
 * @param {UserDataParams} params
 * @returns {string}
 */
export const buildUserData = ({ answers, setupCode }) => {
	if (!SETUP_CODE_PATTERN.test(setupCode)) {
		throw new RangeError('not a setup code');
	}

	const firstBoot = {
		domain: answers.domain,
		email: answers.email,
		timezone: answers.timezone,
		setup_code: setupCode,
	};

	const cloudConfig = {
		package_update: true,
		package_upgrade: true,
		packages: ['ca-certificates', 'curl', 'git', 'jq'],
		users: [
			{
				name: 'fireflyx',
				groups: ['sudo'],
				shell: '/bin/bash',
				sudo: 'ALL=(ALL) NOPASSWD:ALL',
				...(answers.sshKey ? { ssh_authorized_keys: [answers.sshKey] } : {}),
			},
		],
		write_files: [
			{
				path: '/etc/fireflyx/first-boot.json',
				owner: 'root:root',
				permissions: '0600',
				content: `${JSON.stringify(firstBoot)}\n`,
			},
		],
		runcmd: [
			// A few tries: a server with no SSH has no one to notice that GitHub was briefly out of reach.
			['sh', '-c', CLONE_WITH_RETRIES, 'clone', REPO_URL],
			['/opt/fireflyx/scripts/first-boot.sh', 'install'],
		],
	};

	return `#cloud-config\n${JSON.stringify(cloudConfig)}\n`;
};

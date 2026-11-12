import { isIpv4, wildcardRecordFor } from './dns-record.js';
import { newSetupCode } from './setup-code.js';
import { buildUserData, parseAnswers } from './user-data.js';

const MESSAGES = {
	DOMAIN_INVALID: 'Enter a domain such as money.example.com: letters, digits, dots and dashes, no https:// in front.',
	EMAIL_INVALID: 'Enter an email address such as you@example.com.',
	TIMEZONE_UNKNOWN: 'Enter a timezone such as Europe/Ljubljana, spelled as in the list of IANA zones.',
	SSH_KEY_INVALID: 'That is not a public key. It is one line starting with ssh-ed25519 or ssh-rsa.',
};
const INPUT_IDS = { domain: 'domain', email: 'email', timezone: 'timezone', sshKey: 'ssh-key' };
const FIELDS = Object.keys(INPUT_IDS);
const DNS_PLACEHOLDER = '*.<your domain>    A    <server address>';

const byId = (id) => document.getElementById(id);

// One code per page load: the cloud config and the code the person saves must be the same pair.
const setupCode = newSetupCode();

const typedAnswers = () => Object.fromEntries(FIELDS.map((field) => [field, byId(INPUT_IDS[field]).value]));

// With no rejection, every error line is hidden.
const showError = (rejection) => {
	for (const name of FIELDS) {
		const element = byId(`${name}-error`);
		const isRejected = rejection?.field === name;

		element.hidden = !isRejected;
		element.textContent = isRejected ? MESSAGES[rejection.code] : '';
	}
};

const showDomain = (domain) => {
	for (const slot of document.querySelectorAll('.domain-slot')) {
		slot.textContent = domain;
	}
};

const showDnsRecord = (domain) => {
	const ip = byId('ip').value;

	byId('dns-record').textContent = domain && isIpv4(ip) ? wildcardRecordFor({ domain, ip }) : DNS_PLACEHOLDER;
};

// A field is told off once the person has typed in it or left it, not while it is still empty.
const touched = new Set();

const isWorthShowing = (field) => touched.has(field) || byId(INPUT_IDS[field]).value.trim() !== '';

const render = () => {
	const result = parseAnswers(typedAnswers());
	const section = byId('result-section');

	if (result.status === 'rejected') {
		section.hidden = true;
		showDnsRecord('');

		showError(isWorthShowing(result.field) ? result : undefined);

		return;
	}

	showError();
	showDomain(result.answers.domain);
	byId('setup-code').textContent = setupCode;
	byId('user-data').value = buildUserData({ answers: result.answers, setupCode });
	showDnsRecord(result.answers.domain);
	section.hidden = false;
};

const copyUserData = async () => {
	const status = byId('copy-status');

	try {
		await navigator.clipboard.writeText(byId('user-data').value);
		status.textContent = 'Copied.';
	} catch {
		byId('user-data').select();
		status.textContent = 'Press Ctrl+C (Cmd+C on a Mac) to copy the selected text.';
	}
};

const guessTimezone = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
	} catch {
		return '';
	}
};

byId('timezone').value = guessTimezone();
byId('answers-form').addEventListener('input', render);
byId('answers-form').addEventListener(
	'blur',
	(event) => {
		const field = FIELDS.find((name) => INPUT_IDS[name] === event.target.id);

		if (field) {
			touched.add(field);
			render();
		}
	},
	true,
);
byId('answers-form').addEventListener('submit', (event) => event.preventDefault());
byId('ip').addEventListener('input', render);
byId('copy-user-data').addEventListener('click', copyUserData);
render();

# firefly-pocket.com

The public site of [Firefly Pocket](https://github.com/Majster01/firefly-pocket-stack). For now one page:
`/help/hetzner`, which makes the cloud-init a new Hetzner server is created with.

Plain HTML and ES modules, no build step and no dependencies. `npm test` runs `node --test`.

## How the page works

- `js/setup-code.js`: the setup code, made in the browser (`crypto.getRandomValues`) in the format
  `scripts/setup.sh` and `scripts/config.sh` of the stack accept.
- `js/user-data.js`: checks the answers as `scripts/config.sh` does, and builds the cloud-init: `#cloud-config`
  and one line of JSON (valid YAML, so nothing typed can break it).
- `js/dns-record.js`: the wildcard record, for the server address pasted in.
- `js/form.js`: the page's DOM wiring.

Nothing typed is sent anywhere, and `help/hetzner/index.html` sets a Content-Security-Policy that allows only
its own script and stylesheet.

## The contract with the stack

The cloud-init clones the stack's repository, writes `/etc/fireflyx/first-boot.json` (root, `0600`) and runs
`scripts/first-boot.sh install`. The file has four keys, which `scripts/first-boot.sh` in the stack reads:
`domain`, `email`, `timezone`, `setup_code`. Change them in both repositories together.

## Deploying

GitHub Pages, from `.github/workflows/pages.yml`, on every push to `main` once the tests pass. In the
repository's Settings → Pages: source *GitHub Actions*, custom domain `firefly-pocket.com`, *Enforce HTTPS*.
DNS at the domain's provider: A records for the apex to `185.199.108.153`, `185.199.109.153`,
`185.199.110.153` and `185.199.111.153`, and a `www` CNAME to `<github-user>.github.io`.

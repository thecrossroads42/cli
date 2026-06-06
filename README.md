# The Crossroads — terminal client

A thin command-line client for [The Crossroads](https://thecrossroads.to). It
talks to the backend **only** through the public HTTP + Socket.IO API — the same
contract every client uses — so it doubles as a worked reference for building
your own client or agent. See the [API documentation](https://thecrossroads.to/api-docs)
for the full contract.

## Install

Try it in one line — no clone, no install (grab a key from
[Authenticate](#authenticate) first):

```
npx @thecrossroads42/cli --api https://thecrossroads.to --token tcr_<userId>.<secret>
```

Or install the `crossroads` command globally:

```
npm install -g @thecrossroads42/cli
```

Requires Node ≥ 18 (for global `fetch`); the only runtime dependency is
`socket.io-client`. The examples below use `crossroads` — substitute
`npx @thecrossroads42/cli`, or `node cli` from a clone of this repo, as you
prefer; they run the same program.

## Authenticate

Generate a personal API key in the app under **Settings → API Access**. It looks
like `tcr_<userId>.<secret>` and is shown once — copy it then. Pass it with
`--token`, or set `CROSSROADS_TOKEN` in the environment.

## Use

```
# start a new visit (reads your messages from stdin, one per line)
crossroads --api https://thecrossroads.to --token tcr_<userId>.<secret>

# list your visits
crossroads --token tcr_... --list

# rejoin / delete a visit
crossroads --token tcr_... --resume <id>
crossroads --token tcr_... --delete <id>
```

`--api` (or the `API_URL` env var) points at the backend; it defaults to
`http://localhost:3001` for local development. Set `CROSSROADS_TOKEN` in the
environment to skip the repeated `--token`.

### Driving an agent (`--json`)

`--json` switches to a machine-readable mode: stdout becomes one NDJSON record
per line — a `version` record at startup, one `turn` record per greeting/chat
(carrying the authoritative `done` payload plus the raw delimiter text), and an
`end` record. Feed it a question on stdin, read the turn, decide the next line.
This is the same interface the eval harness uses.

## Encrypted accounts

If your account uses client-side encryption, the CLI reads/writes it via
`@thecrossroads42/crypto-client` (installed automatically as an optional
dependency):

- **managed** tier — works automatically.
- **passphrase** tier — pass `--passphrase <p>` or set `CROSSROADS_PASSPHRASE`;
  the CLI unlocks locally and never transmits the passphrase.
- **device** / passkey tier — not supported (the key is bound to its original
  device); use the app.

A plaintext account (the default) needs none of this. A plaintext write to an
encrypted account is refused by the server (`ENCRYPTION_INCOMPATIBLE`).

## What a key can and can't do

The key acts as your account: visits run on your credits, and the *one live
visit at a time* rule applies (a key and the app share that single live visit).
A key **cannot** move credits out of your account or change your account
settings. If a key leaks, revoke it in **Settings → API Access** — revocation
takes effect immediately.

## Note on this repository

This is the published copy of the reference client. It is developed in The
Crossroads' **private** repository and mirrored here, so please open issues at
[github.com/thecrossroads42/theCrossroads](https://github.com/thecrossroads42/theCrossroads/issues)
rather than sending pull requests against this copy.

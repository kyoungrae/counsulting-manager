import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, rmSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

function fixture(enabled, inheritedSecret) {
  const dir = mkdtempSync(join(tmpdir(), 'y2-gateway-test-'));
  mkdirSync(join(dir, 'scripts')); mkdirSync(join(dir, 'deploy/jenkins'), { recursive: true }); mkdirSync(join(dir, 'bin'));
  copyFileSync(resolve('scripts/jenkins-deploy.sh'), join(dir, 'scripts/jenkins-deploy.sh'));
  writeFileSync(join(dir, 'deploy/jenkins/deploy.env'), `COMPOSE_PROJECT_NAME=test\nGATEWAY_ENABLED=${enabled}\n`);
  writeFileSync(join(dir, 'runtime.env'), 'placeholder=1\n');
  const git = join(dir, 'bin/git');
  writeFileSync(git, '#!/bin/sh\nprintf "0123456789012345678901234567890123456789\\n"\n'); chmodSync(git, 0o755);
  const docker = join(dir, 'bin/docker');
  writeFileSync(docker, '#!/bin/sh\nif [ "$1" = compose ]; then printf %s "${#GATEWAY_HMAC_SECRET}" > "$GATEWAY_TEST_RECORD"; fi\nexit 0\n'); chmodSync(docker, 0o755);
  const env = { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, RUNTIME_ENV: join(dir, 'runtime.env'), GATEWAY_TEST_RECORD: join(dir, 'record') };
  if (inheritedSecret === undefined) delete env.GATEWAY_HMAC_SECRET; else env.GATEWAY_HMAC_SECRET = inheritedSecret;
  try {
    const result = spawnSync('bash', [join(dir, 'scripts/jenkins-deploy.sh'), 'deploy'], { cwd: dir, env, encoding: 'utf8' });
    let length = null;
    try { length = readFileSync(join(dir, 'record'), 'utf8'); } catch { /* no docker compose call */ }
    return { result, length };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('disabled gateway clears stale inherited secrets before compose', () => {
  const { result, length } = fixture('false', 'a'.repeat(64));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(length, '0');
});

test('enabled gateway fails before deployment without a sufficiently strong secret', () => {
  for (const secret of [undefined, 'short']) {
    const { result, length } = fixture('true', secret);
    assert.notEqual(result.status, 0);
    assert.equal(length, null);
  }
});

test('enabled gateway passes the secret to compose without printing it', () => {
  const secret = 'sample-secret-for-test-only-'.repeat(3);
  const { result, length } = fixture('true', secret);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(length, String(secret.length));
  assert.equal((result.stdout + result.stderr).includes(secret), false);
});

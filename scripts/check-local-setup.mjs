import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

if (!existsSync(resolve(root, 'docker-compose.yml'))) {
  throw new Error('docker-compose.yml is missing');
}

run('docker', ['compose', 'config', '--quiet']);
run('npm', ['run', 'build'], resolve(root, 'server'));
run('npm', ['test'], resolve(root, 'server'));
run('npm', ['test'], resolve(root, 'mobile'));
run('npm', ['run', 'check:types'], resolve(root, 'mobile'));

console.log('Local setup checks passed. Start dependencies with: docker compose up -d');

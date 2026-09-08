import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outputPath = resolve(process.argv[2] ?? 'src-tauri/tauri.release.conf.json');
const updaterPublicKey = requiredEnvironment('SAEKIM_UPDATER_PUBLIC_KEY');
const runnerOs = process.env.RUNNER_OS ?? '';

const config = {
  bundle: {
    createUpdaterArtifacts: true,
  },
  plugins: {
    updater: {
      endpoints: [
        'https://github.com/beeean17/Saekim/releases/latest/download/latest.json',
      ],
      pubkey: updaterPublicKey,
      windows: {
        installMode: 'passive',
      },
    },
  },
};

if (runnerOs === 'Windows') {
  config.bundle.windows = {
    certificateThumbprint: requiredEnvironment('WINDOWS_CERTIFICATE_THUMBPRINT'),
    digestAlgorithm: 'sha256',
    timestampUrl: requiredEnvironment('WINDOWS_TIMESTAMP_URL'),
  };
}

writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for signed release builds.`);
  return value;
}

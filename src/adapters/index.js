import { ElectronAdapter } from './electron.js';
import { TauriAdapter } from './tauri.js';

export async function makeAdapter(config) {
  const adapter = config.framework === 'electron' ? new ElectronAdapter(config.app) : new TauriAdapter(config.app);
  await adapter.start();
  return adapter;
}

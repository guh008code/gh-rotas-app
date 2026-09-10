export function resolveApiAddress({ explicit, platform, isDevice, host }: { explicit?: string; platform: string; isDevice: boolean; host?: string | null }) {
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, '');
  if (platform === 'android' && !isDevice) return 'http://10.0.2.2:3001';
  if (platform === 'ios' && !isDevice) return 'http://localhost:3001';
  if (host) {
    try {
      const parsed = new URL(host.includes('://') ? host : `http://${host}`);
      return `http://${parsed.hostname}:3001`;
    } catch { /* Fall through to the local development default. */ }
  }
  return 'http://localhost:3001';
}

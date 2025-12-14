export const ensureBrowserCompat = () => {
  const g: any = globalThis as any;
  if (!g.process) {
    g.process = { env: {} };
    return;
  }
  if (!g.process.env) {
    g.process.env = {};
  }
};

ensureBrowserCompat();


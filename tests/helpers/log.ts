export function logIfEnabled(...args: any[]) {
  const shouldLog = process.env.SHOW_LOG === '1' || process.env.SHOW_LOG === 'true';
  if (!shouldLog) return;
  for (const arg of args) {
    console.dir(arg, { depth: null, colors: true });
  }
} 
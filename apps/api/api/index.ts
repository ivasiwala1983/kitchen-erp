let appInstance: any = null;

export default async function handler(req: any, res: any) {
  try {
    if (!appInstance) {
      const appModule = await import('../src/app');
      appInstance = appModule.default || appModule;
    }
    return appInstance(req, res);
  } catch (error: any) {
    console.error('[VERCEL BOOT ERROR]', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      success: false,
      message: 'Vercel Serverless Function Boot Error',
      error: error?.message || String(error),
      stack: error?.stack || null,
    });
  }
}

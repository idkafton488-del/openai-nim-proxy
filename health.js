// api/health.js - Diagnostic endpoint
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const diagnostics = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      hasNimApiKey: !!process.env.NIM_API_KEY,
      nimApiKeyLength: process.env.NIM_API_KEY ? process.env.NIM_API_KEY.length : 0,
      nimApiBase: process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com/v1',
      nodeVersion: process.version
    },
    request: {
      method: req.method,
      url: req.url,
      headers: Object.keys(req.headers)
    }
  };
  
  res.status(200).json(diagnostics);
};

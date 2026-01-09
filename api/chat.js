// api/chat.js - Vercel Serverless Function
const axios = require('axios');

const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;

const MODEL_MAPPING = {
  'gpt-3.5-turbo': 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'gpt-4': 'qwen/qwen3-coder-480b-a35b-instruct',
  'gpt-4-turbo': 'moonshotai/kimi-k2-instruct-0905',
  'gpt-4o': 'deepseek-ai/deepseek-v3.1',
  'claude-3-opus': 'openai/gpt-oss-120b',
  'claude-3-sonnet': 'openai/gpt-oss-20b',
  'gemini-pro': 'qwen/qwen3-next-80b-a3b-thinking',
  'deepseek-v3.2': 'deepseek-ai/deepseek-v3.2',
  'kimi-k2-thinking': 'moonshotai/kimi-k2-thinking',
  'deepseek-v3.1-terminus': 'deepseek-ai/deepseek-v3.1-terminus',
  'glm4.7': 'z-ai/glm4.7'
};

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: { 
        message: 'Method not allowed', 
        type: 'invalid_request_error' 
      } 
    });
  }

  // Check if API key is configured
  if (!NIM_API_KEY) {
    return res.status(500).json({
      error: {
        message: 'NIM_API_KEY not configured in environment variables',
        type: 'server_error'
      }
    });
  }

  try {
    const { model, messages, temperature, max_tokens, stream } = req.body;
    
    // Validate required fields
    if (!model || !messages) {
      return res.status(400).json({
        error: {
          message: 'Missing required fields: model and messages',
          type: 'invalid_request_error'
        }
      });
    }
    
    // Map model or use default
    let nimModel = MODEL_MAPPING[model];
    if (!nimModel) {
      console.log(`Model ${model} not found in mapping, using deepseek-v3.1`);
      nimModel = 'deepseek-ai/deepseek-v3.1';
    }
    
    // Prepare request for NVIDIA API
    const nimRequest = {
      model: nimModel,
      messages: messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 4096,
      stream: false // Disable streaming for Vercel free tier
    };
    
    console.log(`Proxying request to NVIDIA NIM: ${nimModel}`);
    
    // Make request to NVIDIA NIM API
    const response = await axios.post(
      `${NIM_API_BASE}/chat/completions`, 
      nimRequest, 
      {
        headers: {
          'Authorization': `Bearer ${NIM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000 // 25 seconds timeout
      }
    );
    
    // Transform to OpenAI format
    const openaiResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: response.data.choices.map(choice => ({
        index: choice.index || 0,
        message: {
          role: choice.message?.role || 'assistant',
          content: choice.message?.content || ''
        },
        finish_reason: choice.finish_reason || 'stop'
      })),
      usage: response.data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
    
    res.status(200).json(openaiResponse);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: {
          message: 'Request timeout - NVIDIA API took too long to respond',
          type: 'timeout_error',
          code: 504
        }
      });
    }
    
    // Handle NVIDIA API errors
    if (error.response) {
      return res.status(error.response.status).json({
        error: {
          message: error.response.data?.error?.message || error.message,
          type: 'nvidia_api_error',
          code: error.response.status
        }
      });
    }
    
    // Generic error
    res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        type: 'server_error',
        code: 500
      }
    });
  }
};

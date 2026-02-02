const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images

app.post('/api/chat', async (req, res) => {
  const { messages, modelConfig, jsonMode } = req.body;
  
  if (!modelConfig || !modelConfig.apiKey) {
    return res.status(400).json({ error: { message: 'Missing model configuration or API key' } });
  }

  const { apiKey, baseUrl, modelId } = modelConfig;

  // Initialize OpenAI client with dynamic config
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });

  const params = {
    model: modelId,
    messages: messages,
    temperature: 0.7,
  };

  // Enable JSON mode if requested and supported
  // Note: Some models might error if "json" word isn't in prompt, handled by frontend usually
  if (jsonMode) {
    params.response_format = { type: "json_object" };
  }

  try {
    const completion = await client.chat.completions.create(params);
    res.json(completion);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    // Forward the status code from the provider if available
    const status = error.status || 500;
    res.status(status).json({ 
      error: { 
        message: error.message || 'An error occurred',
        code: error.code,
        type: error.type
      } 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

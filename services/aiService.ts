import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Expert, AnalysisResult, StructuredAnalysis, TaskResult, AIModelConfig } from "../types";
import * as mammoth from "mammoth/mammoth.browser";

// Backend API URL (Default to localhost in dev, configurable via env)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// NOTE: We keep GoogleGenAI for multimodal file extraction locally if needed,
// but for chat/tasks, we prefer the unified backend proxy.

const getAIClient = () => {
  const apiKey = process.env.API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in environment variables. File extraction might fail.");
    // Return a dummy or throw, but better to throw when used.
    // throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey: apiKey || 'dummy' });
};

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3, 
  baseDelay: number = 2000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      const errorMessage = error?.message || error?.error?.message || '';
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('Quota exceeded');
      const isOverloaded = errorMessage.includes('503') || errorMessage.includes('Overloaded');
      const isFetchError = errorMessage.includes('Failed to fetch');

      if (isRateLimit || isOverloaded || isFetchError) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; 
        console.warn(`API request failed (Attempt ${attempt + 1}/${maxRetries}). Retrying in ${Math.round(waitTime + jitter)}ms...`);
        await delay(waitTime + jitter);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Calls the Backend Proxy to handle API requests.
 * This is crucial for "No VPN" support (Server-side proxy) and CORS handling.
 */
async function callBackendProxy(
    config: AIModelConfig, 
    messages: Array<{ role: string; content: string }>,
    jsonMode: boolean
): Promise<string> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                modelConfig: config,
                jsonMode
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errMsg = errorText;
            try {
                const json = JSON.parse(errorText);
                errMsg = json.error?.message || json.message || errorText;
            } catch (e) {}
            throw new Error(`Backend Error (${response.status}): ${errMsg}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
        console.error("Backend Proxy Call Failed:", error);
        throw error;
    }
}

/**
 * Unified API Handler.
 * Decides whether to use the Backend Proxy or Direct Browser Call.
 */
async function callAIProvider(
  config: AIModelConfig,
  messages: Array<{ role: string; content: string }>,
  jsonMode: boolean = false
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(`Model ${config.name} is missing API Key`);
  }

  // STRATEGY:
  // 1. If it's a foreign provider (OpenAI, Google) and no custom CORS proxy is set,
  //    we force use our Backend Proxy to ensure connectivity (No VPN needed).
  // 2. If user explicitly set a CORS proxy (e.g. cors-anywhere), use that.
  // 3. For domestic providers (DeepSeek, etc.), try Direct first (faster), 
  //    but if it fails with CORS, we could fallback (not implemented yet, rely on user setting proxy).
  
  const isForeignProvider = ['OpenAI', 'Google'].includes(config.provider);
  const hasCustomProxy = !!config.corsProxy;
  
  // Use Backend Proxy for ALL providers by default (unless user overrides with their own proxy)
  // This solves CORS issues for domestic providers (DeepSeek/Moonshot) and network issues for foreign ones.
  if (!hasCustomProxy) {
      return callBackendProxy(config, messages, jsonMode);
  }

  // --- Direct / CORS Proxy Logic (Only used if user manually set a CORS Proxy) ---

  let endpoint = config.baseUrl?.trim() || '';
  // Fix Endpoint
  if (!endpoint.includes('/chat/completions') && !endpoint.includes('generateContent')) {
      if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
      endpoint += '/chat/completions';
  }

  // Apply Custom CORS Proxy
  if (config.corsProxy) {
      const proxyUrl = config.corsProxy.trim().endsWith('/') ? config.corsProxy.trim() : `${config.corsProxy.trim()}/`;
      endpoint = proxyUrl + endpoint;
  }

  const payload: any = {
    model: config.modelId.trim(),
    messages: messages,
    temperature: 0.7,
  };

  if (jsonMode && config.provider !== 'Moonshot') {
      payload.response_format = { type: "json_object" };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey.trim()}`
  };

  if (config.corsProxy) {
      headers['X-Requested-With'] = 'XMLHttpRequest';
  }

  try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
  } catch (error: any) {
      // If Direct call fails for foreign provider (and we didn't try proxy yet), 
      // maybe we should suggest using the backend?
      // For now, just throw.
      throw error;
  }
}

// Export for compatibility
export const callOpenAICompatibleAPI = callAIProvider;

/**
 * Extracts text content from various file types.
 */
export const extractContentFromFile = async (file: File): Promise<string> => {
  const ai = getAIClient();

  // 1. Text / Markdown
  if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // 2. Word (.docx)
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return `[Word Document Content]:\n${result.value}`;
    } catch (e) {
      console.error("Mammoth error:", e);
      throw new Error("Word Document parsing failed");
    }
  }

  // 3. PDF / Images (Using Gemini Vision)
  // Note: This relies on Client-side API Key currently.
  if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
    try {
      const filePart = await fileToGenerativePart(file);
      const model = 'gemini-2.0-flash'; 

      const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            filePart,
            { text: "Extract all text and describe charts from this file in detail." }
          ]
        }
      }));
      
      return `[AI Extracted Content]:\n${response.text}`;
    } catch (error) {
      console.error("AI Extraction Failed", error);
      throw new Error("AI File Extraction failed. Please check your API Key.");
    }
  }

  throw new Error("Unsupported file format");
};

/**
 * Tests connectivity to a model.
 */
export const testModelConnection = async (config: AIModelConfig): Promise<{ success: boolean; msg: string }> => {
    try {
        await callAIProvider(config, [{ role: 'user', content: 'hi' }]);
        return { success: true, msg: "Connected Successfully" };
    } catch (e: any) {
        return { success: false, msg: e.message || "Connection Failed" };
    }
};

export const generateExpertPersona = async (
  role: string, 
  customPrompt: string, 
  customAvatar?: string, 
  customName?: string
): Promise<Expert> => {
    // We need a default model for system tasks if none provided.
    // For now, use the first available or hardcoded fallback?
    // This function doesn't take config. It assumes a global/default one.
    // Since we don't have global config access here easily without context,
    // we might need to rely on the backend's default or fail if no key.
    
    // TEMPORARY: Use Google GenAI Client directly (Client Side) for persona generation 
    // if we want to keep it simple, OR fetch from backend if we implement a "system" endpoint.
    // Let's stick to the existing behavior: Use getAIClient (Gemini).
    // But updated to use "gemini-2.0-flash"
    
    const ai = getAIClient();
    const systemInstruction = `You are an expert system designer. Create a detailed persona for a ${role} expert. JSON output only.`;
    
    const promptContent = customName 
        ? `Create persona for "${customName}" (${role}). ${customPrompt}`
        : (customPrompt || `Create a top-tier ${role} expert.`);

    try {
        const response = await withRetry(() => ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: promptContent,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                    },
                    required: ["name", "description"]
                }
            }
        }));
        
        const data = JSON.parse(response.text || "{}");
        return {
            id: `custom_${Date.now()}`,
            name: customName || data.name || "Unknown Expert",
            role: role as any,
            avatar: customAvatar || `https://picsum.photos/seed/${Date.now()}/100/100`,
            description: data.description || "No description.",
            isCustom: true,
        };
    } catch (e) {
        console.error("Persona Generation Failed", e);
        // Fallback
        return {
            id: `custom_${Date.now()}`,
            name: customName || "New Expert",
            role: role as any,
            avatar: customAvatar || "",
            description: "Failed to generate description. Please edit manually.",
            isCustom: true
        };
    }
};

export const runExpertTask = async (
  expert: Expert,
  taskDescription: string,
  projectContext: string,
  teamMembers: Expert[] = [],
  depth: number = 0,
  modelConfig?: AIModelConfig
): Promise<TaskResult> => {
  
  const teammatesList = teamMembers.filter(e => e.id !== expert.id).map(e => `- ${e.name} (${e.role})`).join('\n');
  const prompt = `
    [Project]: ${projectContext}
    [Role]: ${expert.name} (${expert.role}) - ${expert.description}
    [Team]: ${teammatesList}
    [Task]: ${taskDescription}
    
    Please respond professionally in Chinese (Markdown).
  `;

  let responseText = "";

  if (modelConfig) {
      responseText = await callAIProvider(modelConfig, [
          { role: 'system', content: `You are ${expert.name}.` },
          { role: 'user', content: prompt }
      ]);
  } else {
      // Fallback to Gemini Direct if no config passed
      const ai = getAIClient();
      const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      }));
      responseText = response.text || "";
  }

  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    expertId: expert.id,
    expertName: expert.name,
    expertAvatar: expert.avatar,
    taskDescription: taskDescription,
    resultContent: responseText,
    timestamp: Date.now(),
  };
};

export const runTeamAnalysis = async (
  projectText: string,
  team: Expert[],
  modelConfig: AIModelConfig
): Promise<AnalysisResult> => {
  const expertsContext = team.map(e => `Name: ${e.name}, Role: ${e.role}, Desc: ${e.description}`).join('\n');
  const prompt = `
    Analyze this project: ${projectText}
    
    Experts:
    ${expertsContext}
    
    Output JSON only with: overallScore, riskLevel, summary, expertInsights[].
  `;

  let responseText = "";
  // Use Unified Provider
  responseText = await callAIProvider(modelConfig, [{ role: 'user', content: prompt }], true);

  // Parse JSON from response (sometimes models output markdown blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
  
  let structuredData;
  try {
      structuredData = JSON.parse(jsonStr);
  } catch (e) {
      console.warn("JSON Parse Failed", e);
      structuredData = null;
  }

  return {
    id: `analysis_${Date.now()}`,
    modelName: modelConfig.name,
    timestamp: Date.now(),
    content: responseText, // Keep raw text
    structuredData: structuredData,
    teamComposition: team.map(e => e.role)
  };
};

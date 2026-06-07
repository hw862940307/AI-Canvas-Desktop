import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { useStore } from '../store/useStore';

export const getModelId = () => {
  const { settings } = useStore.getState();
  return settings.apiSettings.modelId || 'gemini-1.5-flash';
};

export const generateTextWithFallback = async (
  prompt: string | any[], 
  systemPrompt?: string,
  attachments?: any[],
  webSearch?: boolean
): Promise<string> => {
  const { settings } = useStore.getState();
  const api = settings.apiSettings;

  // Dynamically resolve parameters from active API profile to prevent mismatch
  let apiKey = api.apiKey;
  let baseUrl = api.baseUrl;
  let modelId = api.modelId;

  if (api.activeProfileId === 'modelscope') {
    apiKey = api.modelscopeApiKey || apiKey;
    baseUrl = api.modelscopeBaseUrl || baseUrl;
    modelId = api.modelscopeSelectedChatModel || modelId;
  } else if (api.profiles && api.activeProfileId) {
    const activeProf = (api.profiles as any[]).find((p: any) => p.id === api.activeProfileId);
    if (activeProf) {
      apiKey = activeProf.apiKey || apiKey;
      baseUrl = activeProf.baseUrl || baseUrl;
      modelId = activeProf.modelId || modelId;
    }
  }

  if (!apiKey && api.engine === 'gemini') {
    const env = (import.meta as any).env;
    apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : (env ? env.VITE_GEMINI_API_KEY : '');
  }

  if (!apiKey) {
    throw new Error(`API Key for ${api.activeProfileId === 'modelscope' ? 'modelscope' : api.engine} is not configured. Please set it in Settings > API.`);
  }

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // Handle multimodal array formats if passed directly for simple mappings
  if (typeof prompt === 'string') {
    messages.push({ role: 'user', content: prompt });
  } else if (Array.isArray(prompt)) {
    const contentText = prompt.map(item => {
      if (item.text) return item.text;
      return '[Multimodal Array Input]';
    }).join('\n');
    messages.push({ role: 'user', content: contentText });
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      engine: api.activeProfileId === 'modelscope' ? 'modelscope' : api.engine,
      baseUrl: baseUrl,
      apiKey: apiKey,
      modelId: modelId,
      messages: messages,
      attachments: attachments,
      webSearch: webSearch
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Server connection error');
  }

  const data = await response.json();
  return data.text || '';
};

// Deprecated: use generateTextWithFallback instead, keeping for backwards compatibility if needed
export const getGenAI = () => {
    const { settings } = useStore.getState();
    const api = settings.apiSettings;
    
    let apiKey = api.apiKey;
    if (!apiKey || apiKey === '') {
      const env = (import.meta as any).env;
      apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : (env ? env.VITE_GEMINI_API_KEY : '');
    }
  
    if (!apiKey) {
      throw new Error('API Key is not configured. Please set it in Settings > API.');
    }
  
    return new GoogleGenerativeAI(apiKey);
}

import { NextRequest, NextResponse } from "next/server";

// Interface for API messages, consistent with frontend
interface ApiChatMessage {
  role: "user" | "assistant" | "system"; // Gemini uses 'model' for assistant
  content: string;
}

// Interface for Custom API Configuration, aligning with AppContext.tsx
interface CustomApiConfigForBackend {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  apiKeyHeaderName?: string;
  apiKeyPrefix?: string;
  modelParamName?: string;
  messagesParamName?: string;
  responsePath?: string;
}

// Common interface for API error responses to help with type safety
interface ApiErrorResponse {
  error?: {
    message?: string;
    type?: string; // For Anthropic or other specific error types
  };
}

async function callDeepSeekAPI(apiKey: string, messages: ApiChatMessage[], model?: string): Promise<Record<string, unknown>> {
  const API_URL = "https://api.deepseek.com/chat/completions";
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: messages.map(m => ({ role: m.role, content: m.content })), // Ensure correct format
      }),
    });
    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => ({ error: { message: response.statusText }}));
      console.error("DeepSeek API Error:", errorData);
      const typedError = errorData as ApiErrorResponse;
      throw new Error(`DeepSeek API request failed with status ${response.status}: ${typedError.error?.message || response.statusText}`);
    }
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    console.error("Error calling DeepSeek API:", error);
    throw error;
  }
}

async function callOpenAIAPI(apiKey: string, messages: ApiChatMessage[], model?: string): Promise<Record<string, unknown>> {
  const API_URL = "https://api.openai.com/v1/chat/completions";
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-3.5-turbo",
        messages: messages.map(m => ({ role: m.role, content: m.content})),
      }),
    });
    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => ({ error: { message: response.statusText }}));
      console.error("OpenAI API Error:", errorData);
      const typedError = errorData as ApiErrorResponse;
      throw new Error(`OpenAI API request failed with status ${response.status}: ${typedError.error?.message || response.statusText}`);
    }
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}

async function callAnthropicAPI(apiKey: string, messages: ApiChatMessage[], model?: string): Promise<Record<string, unknown>> {
  const API_URL = "https://api.anthropic.com/v1/messages";
  let systemPrompt = "";
  const anthropicMessages = messages
    .filter(msg => {
      if (msg.role === "system") {
        systemPrompt = msg.content;
        return false;
      }
      return true;
    })
    .map(msg => ({ 
      role: msg.role === "assistant" ? "assistant" : "user", // Anthropic uses 'user' and 'assistant'
      content: msg.content 
    }));

  try {
    const body: Record<string, unknown> = {
      model: model || "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: anthropicMessages,
    };
    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => ({ error: { message: response.statusText, type: "unknown_error" }}));
      console.error("Anthropic API Error:", errorData);
      const typedError = errorData as ApiErrorResponse;
      throw new Error(`Anthropic API request failed with status ${response.status}: ${typedError.error?.message || typedError.error?.type || response.statusText}`);
    }
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    console.error("Error calling Anthropic API:", error);
    throw error;
  }
}

async function callGeminiAPI(apiKey: string, messages: ApiChatMessage[], model?: string): Promise<Record<string, unknown>> {
  const geminiHistory = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : (msg.role === "system" ? "user" : msg.role), // Gemini uses 'model' for assistant, and 'user' for system prompts if they are part of history
    parts: [{ text: msg.content }]
  }));
  const currentModel = model || "gemini-1.5-flash-latest";
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ contents: geminiHistory }),
    });

    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => ({ error: { message: response.statusText }}));
      console.error("Gemini API Error:", errorData);
      const typedError = errorData as ApiErrorResponse;
      throw new Error(`Gemini API request failed with status ${response.status}: ${typedError.error?.message || response.statusText}`);
    }
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

async function callCustomAPI(customConfig: CustomApiConfigForBackend, messages: ApiChatMessage[], model?: string): Promise<Record<string, unknown>> {
  const {
    endpoint,
    apiKey,
    apiKeyHeaderName,
    apiKeyPrefix,
    modelParamName,
    messagesParamName,
  } = customConfig;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKeyHeaderName && apiKey) {
    headers[apiKeyHeaderName] = `${apiKeyPrefix || ""}${apiKey}`;
  } else if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const body: Record<string, unknown> = {};
  const effectiveMessagesParamName = messagesParamName || "messages";
  body[effectiveMessagesParamName] = messages.map(m => ({ role: m.role, content: m.content})); // Ensure consistent message format

  if (modelParamName && model) {
    body[modelParamName] = model;
  } else if (model) {
    body["model"] = model;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch { // Removed unused catch parameter
        errorData = { error: { message: await response.text() } };
      }
      console.error(`Custom API Error (${customConfig.name}):`, errorData);
      const typedError = errorData as ApiErrorResponse;
      throw new Error(`Custom API request to ${customConfig.name} failed with status ${response.status}: ${typedError.error?.message || response.statusText}`);
    }
    return await response.json() as Record<string, unknown>;
  } catch (error) {
    console.error(`Error calling Custom API (${customConfig.name}):`, error);
    throw error;
  }
}

function getNestedValue(obj: Record<string, unknown> | unknown, path: string): string | undefined {
  if (!path) return undefined;
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  const value = path.split(".").reduce((acc: unknown, part: string): unknown => {
    if (typeof acc === 'object' && acc !== null && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj); 

  return typeof value === 'string' ? value : undefined;
}

interface RequestBody {
    provider: string;
    apiKey?: string;
    messages: Array<{ sender: string; text: string; }>;
    model?: string;
    customApiConfig?: CustomApiConfigForBackend;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody;
    const { provider, apiKey, messages, model: requestedModel, customApiConfig } = body;

    if (!provider || !messages) {
      return NextResponse.json({ error: "Missing provider or messages" }, { status: 400 });
    }
    if (!customApiConfig && !apiKey) {
      return NextResponse.json({ error: "Missing apiKey" }, { status: 400 });
    }

    let responseData: Record<string, unknown>; 
    const apiMessages: ApiChatMessage[] = messages.map((msg: { sender: string; text: string; }) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text
    }));

    let isCustomProvider = false;
    if (customApiConfig && customApiConfig.id === provider) {
      isCustomProvider = true;
    }

    if (isCustomProvider && customApiConfig) { 
      responseData = await callCustomAPI(customApiConfig, apiMessages, requestedModel);
    } else if (apiKey) { 
      switch (provider) {
        case "deepseek":
          responseData = await callDeepSeekAPI(apiKey, apiMessages, requestedModel);
          break;
        case "openai":
          responseData = await callOpenAIAPI(apiKey, apiMessages, requestedModel);
          break;
        case "anthropic":
          responseData = await callAnthropicAPI(apiKey, apiMessages, requestedModel);
          break;
        case "gemini":
          responseData = await callGeminiAPI(apiKey, apiMessages, requestedModel);
          break;
        default:
          return NextResponse.json({ error: "Unsupported or misconfigured AI provider" }, { status: 400 });
      }
    } else {
        return NextResponse.json({ error: "Provider configuration error" }, { status: 400 });
    }

    let aiMessageText = "Error: Could not parse AI response.";

    if (isCustomProvider && customApiConfig?.responsePath) {
      const extractedText = getNestedValue(responseData, customApiConfig.responsePath);
      if (typeof extractedText === 'string') {
        aiMessageText = extractedText;
      } else {
        console.warn(`Custom API (${customApiConfig.name}) response path did not yield a string:`, extractedText);
        aiMessageText = "Error: Custom API response format mismatch.";
      }
    } else if (provider === "anthropic") {
      if (
        responseData &&
        typeof responseData === 'object' &&
        Array.isArray(responseData.content) &&
        responseData.content.length > 0
      ) {
        const firstContentItem = responseData.content[0] as Record<string, unknown> | undefined;
        if (firstContentItem && typeof firstContentItem.text === 'string') {
          aiMessageText = firstContentItem.text;
        }
      }
    } else if (provider === "openai" || provider === "deepseek") {
      if (
        responseData &&
        typeof responseData === 'object' &&
        Array.isArray(responseData.choices) &&
        responseData.choices.length > 0
      ) {
        const firstChoice = responseData.choices[0] as Record<string, unknown> | undefined;
        if (
          firstChoice &&
          typeof firstChoice === 'object' &&
          firstChoice.message &&
          typeof firstChoice.message === 'object'
        ) {
          const message = firstChoice.message as Record<string, unknown> | undefined;
          if (message && typeof message.content === 'string') {
            aiMessageText = message.content;
          }
        }
      }
    } else if (provider === "gemini") {
      if (
        responseData &&
        typeof responseData === 'object' &&
        Array.isArray(responseData.candidates) &&
        responseData.candidates.length > 0
      ) {
        const firstCandidate = responseData.candidates[0] as Record<string, unknown> | undefined;
        if (
          firstCandidate &&
          typeof firstCandidate === 'object' &&
          firstCandidate.content &&
          typeof firstCandidate.content === 'object'
        ) {
          const content = firstCandidate.content as Record<string, unknown> | undefined;
          if (
            content &&
            Array.isArray(content.parts) &&
            content.parts.length > 0
          ) {
            const firstPart = content.parts[0] as Record<string, unknown> | undefined;
            if (
              firstPart &&
              typeof firstPart === 'object' &&
              typeof firstPart.text === 'string'
            ) {
              aiMessageText = firstPart.text;
            }
          }
        }
      }
    } else if (isCustomProvider) {
      // Fallback for custom providers if responsePath is not set or fails, try common structures
      if (
        responseData &&
        typeof responseData === 'object' &&
        Array.isArray(responseData.choices) &&
        responseData.choices.length > 0
      ) {
        const firstChoice = responseData.choices[0] as Record<string, unknown> | undefined;
        if (
          firstChoice &&
          typeof firstChoice === 'object' &&
          firstChoice.message &&
          typeof firstChoice.message === 'object'
        ) {
          const message = firstChoice.message as Record<string, unknown> | undefined;
          if (message && typeof message.content === 'string') {
            aiMessageText = message.content;
          }
        }
      } else if (
        responseData &&
        typeof responseData === 'object' &&
        Array.isArray(responseData.content) &&
        responseData.content.length > 0
      ) {
        const firstContentItem = responseData.content[0] as Record<string, unknown> | undefined;
        if (firstContentItem && typeof firstContentItem.text === 'string') {
          aiMessageText = firstContentItem.text;
        }
      }
    }

    return NextResponse.json({ aiResponse: aiMessageText, rawResponse: responseData });

  } catch (error: unknown) {
    console.error("API Route Error:", error);
    const message = error instanceof Error ? error.message : "An internal server error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


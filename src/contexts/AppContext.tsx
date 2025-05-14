import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Interfaces from previous steps (Message, ChatSession) remain the same
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

export interface ChatSession { // Added export here
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
}

interface ApiKeys {
  deepseek?: string;
  openai?: string;
  anthropic?: string;
  gemini?: string;
  replicate?: string;
  openrouter?: string;
  [key: string]: string | undefined; // For custom API keys by name
}

// New interface for Custom API Configuration
export interface CustomApiConfig {
  id: string; // Unique ID for the custom API config
  name: string; // User-defined name for this API (e.g., "MyLLM")
  endpoint: string; // API endpoint URL
  apiKey: string; // The actual API key for this custom service
  apiKeyHeaderName?: string; // e.g., "Authorization", "X-API-Key"
  apiKeyPrefix?: string; // e.g., "Bearer " (include trailing space if needed)
  modelParamName?: string; // e.g., "model"
  messagesParamName?: string; // e.g., "messages", "prompt", "inputs"
  // Path to extract the AI's response text, using dot notation for nesting
  // e.g., "choices.0.message.content", "data.output.text", "results.0.text"
  responsePath?: string; 
}

interface AppContextType {
  sessions: ChatSession[];
  currentSessionId: string | null;
  apiKeys: ApiKeys; // For pre-defined services
  customApiConfigs: CustomApiConfig[]; // For user-defined services
  createNewSession: () => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  addMessageToSession: (sessionId: string, message: Message) => void;
  updateApiKey: (provider: string, key: string) => void; // provider can be predefined or custom API ID
  getApiKey: (provider: string) => string | undefined;
  addCustomApiConfig: (config: Omit<CustomApiConfig, 'id'>) => void;
  updateCustomApiConfig: (config: CustomApiConfig) => void;
  removeCustomApiConfig: (configId: string) => void;
  getCustomApiConfig: (configId: string) => CustomApiConfig | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppWrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({}); // For DeepSeek, OpenAI etc.
  const [customApiConfigs, setCustomApiConfigs] = useState<CustomApiConfig[]>([]);

  // Load initial state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedKeys = localStorage.getItem('apiKeys');
      if (storedKeys) {
        setApiKeys(JSON.parse(storedKeys));
      }
      const storedCustomConfigs = localStorage.getItem('customApiConfigs');
      if (storedCustomConfigs) {
        setCustomApiConfigs(JSON.parse(storedCustomConfigs));
      }
      
      const storedSessions = localStorage.getItem('chatSessions');
      const storedCurrentSessionId = localStorage.getItem('currentSessionId');
      if (storedSessions) {
        const parsedSessions = JSON.parse(storedSessions);
        setSessions(parsedSessions);
        if (storedCurrentSessionId && parsedSessions.find((s: ChatSession) => s.id === storedCurrentSessionId)) {
          setCurrentSessionIdState(storedCurrentSessionId);
        } else if (parsedSessions.length > 0) {
          setCurrentSessionIdState(parsedSessions[0].id);
        }
      }

      if (sessions.length === 0 && !storedSessions) {
        createNewSession(); // Create an initial session if none exist and none in storage
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist sessions and currentSessionId to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
      if (currentSessionId) {
        localStorage.setItem('currentSessionId', currentSessionId);
      } else {
        localStorage.removeItem('currentSessionId');
      }
    }
  }, [sessions, currentSessionId]);

  // Persist API keys and custom configs to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
    }
  }, [apiKeys]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('customApiConfigs', JSON.stringify(customApiConfigs));
    }
  }, [customApiConfigs]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      name: `Chat ${sessions.length + 1}`,
      messages: [],
      createdAt: Date.now(),
    };
    setSessions(prevSessions => [...prevSessions, newSession]);
    setCurrentSessionIdState(newSession.id);
  };

  const addMessageToSession = (sessionId: string, message: Message) => {
    setSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === sessionId
          ? { ...session, messages: [...session.messages, message] }
          : session
      )
    );
  };

  const updateApiKey = (provider: string, key: string) => {
    // Check if it's a predefined API or a custom one by checking if it's an ID in customApiConfigs
    const isCustom = customApiConfigs.some(c => c.id === provider);
    if (isCustom) {
      setCustomApiConfigs(prevConfigs => 
        prevConfigs.map(c => c.id === provider ? { ...c, apiKey: key } : c)
      );
    } else {
      setApiKeys(prevKeys => ({ ...prevKeys, [provider]: key }));
    }
  };

  const getApiKey = (provider: string): string | undefined => {
    const customConfig = customApiConfigs.find(c => c.id === provider || c.name === provider);
    if (customConfig) return customConfig.apiKey;
    return apiKeys[provider];
  };

  const addCustomApiConfig = (configData: Omit<CustomApiConfig, 'id'>) => {
    const newConfig: CustomApiConfig = {
      ...configData,
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
    setCustomApiConfigs(prevConfigs => [...prevConfigs, newConfig]);
  };

  const updateCustomApiConfig = (updatedConfig: CustomApiConfig) => {
    setCustomApiConfigs(prevConfigs =>
      prevConfigs.map(config => (config.id === updatedConfig.id ? updatedConfig : config))
    );
  };

  const removeCustomApiConfig = (configId: string) => {
    setCustomApiConfigs(prevConfigs => prevConfigs.filter(config => config.id !== configId));
  };

  const getCustomApiConfig = (configIdOrName: string): CustomApiConfig | undefined => {
    return customApiConfigs.find(c => c.id === configIdOrName || c.name === configIdOrName);
  };

  const setCurrentSessionId = (sessionId: string | null) => {
    setCurrentSessionIdState(sessionId);
  };

  return (
    <AppContext.Provider value={{
      sessions,
      currentSessionId,
      apiKeys,
      customApiConfigs,
      createNewSession,
      setCurrentSessionId,
      addMessageToSession,
      updateApiKey,
      getApiKey,
      addCustomApiConfig,
      updateCustomApiConfig,
      removeCustomApiConfig,
      getCustomApiConfig
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppWrapper');
  }
  return context;
};

// Ensure Message type is also exported if needed elsewhere, though it seems locally used for now.
// export type { Message }; // Uncomment if Message needs to be imported by other files.


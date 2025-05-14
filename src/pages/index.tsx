import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useRouter } from 'next/router';
import Head from 'next/head';
import React, { useState, useEffect, FormEvent, KeyboardEvent } from 'react'; // Added KeyboardEvent
import { useAppContext, CustomApiConfig, ChatSession } from '../contexts/AppContext'; // Changed Session to ChatSession

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  };
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

// Define a more specific type for the request body to /api/chat
interface ChatRequestBody {
  provider: string;
  messages: Array<{ sender: string; text: string }>;
  apiKey?: string; // Optional because it might be in customApiConfig
  customApiConfig?: CustomApiConfig;
  model?: string;
}

interface ApiError {
    error?: string | { message?: string }; 
}

export default function ChatPage() {
  const { t, i18n } = useTranslation('common');
  const router = useRouter();
  const {
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
  } = useAppContext();

  const [userInput, setUserInput] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempApiKeys, setTempApiKeys] = useState<{[key: string]: string | undefined}>({});
  const [tempCustomApiConfigs, setTempCustomApiConfigs] = useState<CustomApiConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (showSettingsModal) {
      setTempApiKeys({...apiKeys});
      setTempCustomApiConfigs(JSON.parse(JSON.stringify(customApiConfigs))); // Deep copy
    }
  }, [showSettingsModal, apiKeys, customApiConfigs]);

  useEffect(() => {
    if (!activeProvider) {
      const firstPredefinedKey = Object.keys(apiKeys).find(k => !!apiKeys[k as keyof typeof apiKeys]);
      if (firstPredefinedKey) {
        setActiveProvider(firstPredefinedKey);
      } else if (customApiConfigs.length > 0 && customApiConfigs[0].apiKey) {
        setActiveProvider(customApiConfigs[0].id);
      }
    }
  }, [apiKeys, customApiConfigs, activeProvider]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    router.push(router.pathname, router.asPath, { locale: lng });
  };

  const handleSendMessage = async (e: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (!userInput.trim() || !currentSessionId || !activeProvider || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      text: userInput,
      sender: 'user',
      timestamp: Date.now(),
    };
    addMessageToSession(currentSessionId, userMessage);
    
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const currentChatHistoryForAPI = currentSession ? [...currentSession.messages, userMessage] : [userMessage];

    setUserInput('');
    setIsLoading(true);

    try {
      let providerApiKey: string | undefined;
      const providerConfig = getCustomApiConfig(activeProvider);

      if (providerConfig) {
        providerApiKey = providerConfig.apiKey;
      } else {
        providerApiKey = getApiKey(activeProvider);
      }

      if (!providerApiKey) {
        throw new Error(`${t('API key for')} ${activeProvider} ${t('is not configured')}.`);
      }

      const requestBody: ChatRequestBody = {
        provider: activeProvider,
        messages: currentChatHistoryForAPI.map(m => ({ sender: m.sender, text: m.text })),
        apiKey: providerConfig ? undefined : providerApiKey,
        customApiConfig: providerConfig ? providerConfig : undefined,
      };
      if (activeModel) {
        requestBody.model = activeModel;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => ({ error: response.statusText }));
        let errorMessage = `${t('API request failed with status')} ${response.status}`;
        if (typeof errorData === 'object' && errorData !== null && 'error' in errorData) {
            const errorVal = (errorData as ApiError).error;
            if (typeof errorVal === 'string') {
                errorMessage = errorVal;
            } else if (typeof errorVal === 'object' && errorVal !== null && 'message' in errorVal && typeof errorVal.message === 'string') {
                errorMessage = errorVal.message;
            }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json() as { aiResponse?: string; /* other potential fields */ };
      const aiResponseMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        text: data.aiResponse || t('Error: No response text from AI'),
        sender: 'ai',
        timestamp: Date.now(),
      };
      addMessageToSession(currentSessionId, aiResponseMessage);

    } catch (error: unknown) { // Type error as unknown
      console.error('Error sending message:', error);
      const messageText = error instanceof Error ? error.message : t('Failed to get response from AI.');
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        text: `${t('Error')}: ${messageText}`,
        sender: 'ai',
        timestamp: Date.now(),
      };
      addMessageToSession(currentSessionId, errorMessage);
    }
    setIsLoading(false);
  };

  const currentMessages = sessions.find(s => s.id === currentSessionId)?.messages || [];

  const handleApiKeyChange = (providerId: string, value: string) => {
    setTempApiKeys(prev => ({ ...prev, [providerId]: value }));
  };

  const handleCustomConfigChange = (index: number, field: keyof CustomApiConfig, value: string) => {
    setTempCustomApiConfigs(prev =>
      prev.map((config, i) => i === index ? { ...config, [field]: value } : config)
    );
  };

  const addTempCustomApiConfig = () => {
    setTempCustomApiConfigs(prev => [...prev, { id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, name: '', endpoint: '', apiKey: ''}]);
  };

  const removeTempCustomApiConfig = (idx: number) => {
    setTempCustomApiConfigs(prev => prev.filter((_, i) => i !== idx));
  };

 const saveSettings = () => {
    Object.entries(tempApiKeys).forEach(([providerId, key]) => {
      if (key !== undefined) {
        updateApiKey(providerId, key);
      }
    });

    tempCustomApiConfigs.forEach(tempConfig => {
      if (tempConfig.id.startsWith('new-')) {
        if (tempConfig.name && tempConfig.endpoint && tempConfig.apiKey) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...newConfigData } = tempConfig; // Destructure to remove temporary ID
          addCustomApiConfig(newConfigData as Omit<CustomApiConfig, 'id'>); // Cast to exclude id
        }
      } else {
        const originalConfig = customApiConfigs.find(c => c.id === tempConfig.id);
        if (originalConfig && JSON.stringify(originalConfig) !== JSON.stringify(tempConfig)) {
          updateCustomApiConfig(tempConfig);
        }
      }
    });

    customApiConfigs.forEach(originalConfig => {
      if (!tempCustomApiConfigs.find(tempC => tempC.id === originalConfig.id)) {
        removeCustomApiConfig(originalConfig.id);
      }
    });

    setShowSettingsModal(false);
  };

  const predefinedApiKeyProviders = [
    { id: 'deepseek', name: t('deepseekApiKey') },
    { id: 'openai', name: t('openaiApiKey') },
    { id: 'anthropic', name: t('anthropicApiKey') },
    { id: 'gemini', name: t('geminiApiKey') },
  ];

  const allProvidersForSelection = [
    ...predefinedApiKeyProviders.map(p => ({id: p.id, name: p.name})),
    ...customApiConfigs.map(c => ({id: c.id, name: c.name || t('Unnamed Custom API')}))
  ];
  
  const languageOptions = [
    { value: 'zh', label: '中文 (简体)' },
    { value: 'en', label: 'English' },
    { value: 'ko', label: '한국어' },
    { value: 'ja', label: '日本語' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'ru', label: 'Русский' },
  ];

  const currentSessionName = sessions.find(s => s.id === currentSessionId)?.name || t('newChat');

  return (
    <>
      <Head>
        <title>{`${currentSessionName} - Kimi Clone`}</title>
      </Head>
      <div className="flex h-screen antialiased text-gray-800 bg-slate-100">
        <div className="flex flex-row h-full w-full overflow-x-hidden">
          {/* Sidebar */}
          <div className="flex flex-col py-6 px-4 w-80 bg-white flex-shrink-0 border-r border-slate-200 shadow-lg">
            <div className="flex flex-row items-center justify-center h-12 w-full mb-5">
              <div className="flex items-center justify-center rounded-xl text-teal-600 bg-teal-100 h-10 w-10">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </div>
              <div className="ml-3 font-semibold text-2xl text-teal-700">KimiClone</div>
            </div>
            <button
              onClick={createNewSession}
              className="flex flex-row items-center justify-center bg-teal-500 hover:bg-teal-600 text-white font-medium py-2.5 px-4 rounded-lg w-full mb-6 shadow-sm hover:shadow-md transition-shadow duration-150">
              {t('newChat')}
            </button>

            <div className="flex flex-col mt-2 -mx-2 overflow-y-auto flex-grow">
              <span className="px-2 mb-1 text-xs text-slate-500 font-semibold uppercase tracking-wider">{t('Sessions')}</span>
              {sessions.map((session: ChatSession) => ( // Changed Session to ChatSession
                <button
                  key={session.id}
                  onClick={() => setCurrentSessionId(session.id)}
                  className={`flex flex-row items-center hover:bg-slate-100 rounded-lg p-2.5 my-0.5 text-left w-full transition-colors duration-150 ${currentSessionId === session.id ? 'bg-teal-50 text-teal-700 font-semibold' : 'text-slate-700'}`}>
                  {session.name}
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
                <label htmlFor="activeProviderSelect" className="block text-xs font-medium text-slate-600 px-1 mb-1.5">{t('Active AI Provider')}</label>
                <select
                    id="activeProviderSelect"
                    value={activeProvider || ''}
                    onChange={(e) => setActiveProvider(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm mb-2 bg-white">
                    <option value="" disabled>{t('Select a provider')}</option>
                    {allProvidersForSelection.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                 <input
                    type="text"
                    placeholder={t('Optional: Model Name (e.g., gpt-4)')}
                    value={activeModel || ''}
                    onChange={(e) => setActiveModel(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white"
                  />
            </div>

            <div className="flex flex-col mt-auto pt-4 border-t border-slate-200">
              <label htmlFor="languageSelect" className="block text-xs font-medium text-slate-600 px-1 mb-1.5">{t('language')}</label>
              <select
                id="languageSelect"
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm mb-4 bg-white">
                {languageOptions.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex flex-row items-center justify-center bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2.5 px-4 rounded-lg w-full transition-colors duration-150">
                  {t('settings')}
              </button>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex flex-col flex-auto h-full p-6">
            <div className="flex flex-col flex-auto flex-shrink-0 rounded-2xl bg-white border border-slate-200 h-full p-4 shadow-md">
              <div className="flex flex-col h-full overflow-x-auto mb-4 flex-grow">
                <div className="flex flex-col h-full py-2">
                  {currentMessages.length === 0 && (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      {t('No messages yet. Start a conversation!')}
                    </div>
                  )}
                  <div className="space-y-3">
                    {currentMessages.map(msg => (
                      <div key={msg.id} className={`col-span-12 p-1 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex flex-row items-end max-w-xl ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex items-center justify-center h-10 w-10 rounded-full ${msg.sender === 'user' ? 'bg-teal-500' : 'bg-sky-500'} flex-shrink-0 text-white text-sm font-medium`}>
                            {msg.sender === 'user' ? 'U' : 'AI'}
                          </div>
                          <div className={`relative text-sm py-2.5 px-4 shadow-md rounded-xl ${msg.sender === 'user' ? 'mr-2.5 bg-teal-100 text-teal-800' : 'ml-2.5 bg-sky-100 text-sky-800'}`}>
                            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</div>
                            <div className={`text-xs text-slate-500 mt-1.5 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                        <div className="col-span-12 p-1 flex justify-start">
                            <div className="flex flex-row items-end max-w-xl">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-slate-300 flex-shrink-0 text-white text-sm font-medium">
                                    AI
                                </div>
                                <div className="relative ml-2.5 text-sm bg-slate-100 text-slate-600 py-2.5 px-4 shadow-md rounded-xl">
                                    {t('AI is thinking...')}
                                </div>
                            </div>
                        </div>
                    )}
                  </div>
                </div>
              </div>
              <form onSubmit={handleSendMessage} className="flex flex-row items-center h-20 rounded-xl bg-slate-50 w-full px-4 border-t border-slate-200">
                <div className="flex-grow">
                  <div className="relative w-full">
                    <textarea
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault(); 
                          handleSendMessage(e as unknown as KeyboardEvent<HTMLTextAreaElement>); // Cast to KeyboardEvent
                        }
                      }}
                      placeholder={t('Type your message...')}
                      className="flex w-full border rounded-xl focus:outline-none focus:border-teal-500 py-3 px-4 text-slate-700 bg-white resize-none h-14 min-h-[3.5rem] max-h-40 shadow-sm transition-shadow focus:shadow-md"
                      rows={1} // Start with 1 row, will expand
                    />
                  </div>
                </div>
                <div className="ml-4">
                  <button type="submit" disabled={isLoading || !userInput.trim()}
                    className="flex items-center justify-center bg-teal-500 hover:bg-teal-600 rounded-xl text-white px-5 py-3 flex-shrink-0 disabled:opacity-50 transition-colors duration-150 shadow-sm hover:shadow-md">
                    <span>{t('send')}</span>
                    <span className="ml-2">
                      <svg className="w-4 h-4 transform rotate-45 -mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <h2 className="text-2xl font-semibold mb-6 text-slate-800">{t('API Settings')}</h2>
            
            <div className="overflow-y-auto flex-grow pr-2 space-y-6">
              {/* Predefined API Keys */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-slate-700 border-b pb-2 mb-3">{t('Predefined APIs')}</h3>
                {predefinedApiKeyProviders.map(provider => (
                  <div key={provider.id}>
                    <label htmlFor={`${provider.id}-key`} className="block text-sm font-medium text-slate-600 mb-1">{provider.name}</label>
                    <input
                      type="password"
                      id={`${provider.id}-key`}
                      value={tempApiKeys[provider.id] || ''}
                      onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                      placeholder={`${t('Enter API Key for')} ${provider.name.replace(t(' API Key'), '')}`}
                      className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                ))}
              </div>

              {/* Custom API Configurations */}
              <div>
                <h3 className="text-lg font-medium text-slate-700 border-b pb-2 mb-3">{t('Custom APIs')}</h3>
                {tempCustomApiConfigs.map((config, index) => (
                  <div key={config.id} className="p-4 border border-slate-200 rounded-lg mb-4 bg-slate-50 space-y-3">
                    <div className="flex justify-between items-center">
                        <p className="text-md font-semibold text-teal-700">{config.name || t("New Custom API")}</p>
                        <button onClick={() => removeTempCustomApiConfig(index)} className="text-red-500 hover:text-red-700 text-sm font-medium">{t("Remove")}</button>
                    </div>
                    <div>
                      <label htmlFor={`custom-name-${index}`} className="block text-xs font-medium text-slate-600 mb-0.5">{t("API Name")}</label>
                      <input type="text" id={`custom-name-${index}`} value={config.name} onChange={(e) => handleCustomConfigChange(index, 'name', e.target.value)} placeholder={t("e.g., My Local LLM")} className="w-full p-2 border border-slate-300 rounded-md shadow-sm text-sm" />
                    </div>
                    <div>
                      <label htmlFor={`custom-endpoint-${index}`} className="block text-xs font-medium text-slate-600 mb-0.5">{t("Endpoint URL")}</label>
                      <input type="text" id={`custom-endpoint-${index}`} value={config.endpoint} onChange={(e) => handleCustomConfigChange(index, 'endpoint', e.target.value)} placeholder="https://example.com/api/chat" className="w-full p-2 border border-slate-300 rounded-md shadow-sm text-sm" />
                    </div>
                    <div>
                      <label htmlFor={`custom-apikey-${index}`} className="block text-xs font-medium text-slate-600 mb-0.5">{t("API Key")}</label>
                      <input type="password" id={`custom-apikey-${index}`} value={config.apiKey} onChange={(e) => handleCustomConfigChange(index, 'apiKey', e.target.value)} placeholder={t("Enter API Key")} className="w-full p-2 border border-slate-300 rounded-md shadow-sm text-sm" />
                    </div>
                    <details className="text-sm">
                        <summary className="cursor-pointer text-teal-600 hover:text-teal-700 font-medium">{t("Advanced Options")}</summary>
                        <div className="mt-2 space-y-2 pl-2 border-l-2 border-teal-200">
                            <div>
                                <label htmlFor={`custom-headername-${index}`} className="block text-xs font-medium text-slate-500 mb-0.5">{t("API Key Header Name (optional)")}</label>
                                <input type="text" id={`custom-headername-${index}`} value={config.apiKeyHeaderName || ''} onChange={(e) => handleCustomConfigChange(index, 'apiKeyHeaderName', e.target.value)} placeholder="Authorization" className="w-full p-1.5 border border-slate-300 rounded-md shadow-sm text-xs" />
                            </div>
                            <div>
                                <label htmlFor={`custom-keyprefix-${index}`} className="block text-xs font-medium text-slate-500 mb-0.5">{t("API Key Prefix (optional)")}</label>
                                <input type="text" id={`custom-keyprefix-${index}`} value={config.apiKeyPrefix || ''} onChange={(e) => handleCustomConfigChange(index, 'apiKeyPrefix', e.target.value)} placeholder="Bearer " className="w-full p-1.5 border border-slate-300 rounded-md shadow-sm text-xs" />
                            </div>
                            <div>
                                <label htmlFor={`custom-modelparam-${index}`} className="block text-xs font-medium text-slate-500 mb-0.5">{t("Model Parameter Name (optional)")}</label>
                                <input type="text" id={`custom-modelparam-${index}`} value={config.modelParamName || ''} onChange={(e) => handleCustomConfigChange(index, 'modelParamName', e.target.value)} placeholder="model" className="w-full p-1.5 border border-slate-300 rounded-md shadow-sm text-xs" />
                            </div>
                            <div>
                                <label htmlFor={`custom-messagesparam-${index}`} className="block text-xs font-medium text-slate-500 mb-0.5">{t("Messages Parameter Name (optional)")}</label>
                                <input type="text" id={`custom-messagesparam-${index}`} value={config.messagesParamName || ''} onChange={(e) => handleCustomConfigChange(index, 'messagesParamName', e.target.value)} placeholder="messages" className="w-full p-1.5 border border-slate-300 rounded-md shadow-sm text-xs" />
                            </div>
                            <div>
                                <label htmlFor={`custom-responsepath-${index}`} className="block text-xs font-medium text-slate-500 mb-0.5">{t("Response Text Path (optional)")}</label>
                                <input type="text" id={`custom-responsepath-${index}`} value={config.responsePath || ''} onChange={(e) => handleCustomConfigChange(index, 'responsePath', e.target.value)} placeholder="choices.0.message.content" className="w-full p-1.5 border border-slate-300 rounded-md shadow-sm text-xs" />
                            </div>
                        </div>
                    </details>
                  </div>
                ))}
                <button onClick={addTempCustomApiConfig} className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium py-2 px-3 border border-teal-500 rounded-md hover:bg-teal-50 transition-colors">{t("Add Custom API")}</button>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3 border-t pt-5">
              <button onClick={() => setShowSettingsModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">{t('cancel')}</button>
              <button onClick={saveSettings} className="px-5 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md transition-colors shadow-sm hover:shadow-md">{t('saveSettings')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


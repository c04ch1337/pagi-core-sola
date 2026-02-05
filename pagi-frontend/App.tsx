
import React, { useState, useEffect } from 'react';
import ChatView from './components/ChatView';
import Sidebar from './components/Sidebar';
import ProjectsView from './components/ProjectsView';
import SystemRegistry from './components/SystemRegistry';
import SettingsView from './components/SettingsView';
import { View } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<'active' | 'thinking'>('active');
  const [currentView, setCurrentView] = useState<View>(View.CHAT);
  const [customStyles, setCustomStyles] = useState('');

  // Initial Configuration Setup
  useEffect(() => {
    const saved = localStorage.getItem('phoenix_config');
    if (!saved) {
      const defaultOptions = {
        provider: 'openrouter',
        model: 'deepseek/deepseek-v3.2',
        apiKey: '••••••••••••••••',
        backendUrl: 'https://openrouter.ai/api/v1',
        bridgeUrl: 'http://127.0.0.1:8001',
        logoUrl: '',
        faviconUrl: '',
        latencyTarget: 50,
        theme: 'system',
        accentColor: '#10B981',
        density: 'compact',
        nvcSensitivity: 0.8,
        privacyShield: true,
        telemetry: true,
        customCss: '',
        persona: 'professional',
        creativity: 0.7,
        thinkingBudget: 0,
        responseDepth: 0.5,
        customDirectives: '',
        userAlias: 'User',
      };
      localStorage.setItem('phoenix_config', JSON.stringify(defaultOptions));
    }
  }, []);

  // Load and monitor custom configuration for live styling updates
  useEffect(() => {
    const applyConfig = () => {
      const saved = localStorage.getItem('phoenix_config');
      if (saved) {
        try {
          const config = JSON.parse(saved);
          if (config.customCss) {
            setCustomStyles(config.customCss);
          }
          
          // Apply Favicon
          if (config.faviconUrl) {
            let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = config.faviconUrl;
          }

          // Apply Theme globally to HTML element
          if (config.theme === 'dark' || (config.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        } catch (e) {
          console.error("Config parsing error", e);
        }
      }
    };

    applyConfig();
    window.addEventListener('storage', applyConfig);
    return () => window.removeEventListener('storage', applyConfig);
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case View.CHAT:
        return (
          <div className="max-w-2xl mx-auto h-full w-full relative">
            <ChatView onStatusChange={setStatus} />
          </div>
        );
      case View.PROJECTS:
        return <ProjectsView />;
      case View.REGISTRY:
        return <SystemRegistry />;
      case View.SETTINGS:
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#F0F4F0] dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 font-sans selection:bg-sage-200 transition-colors duration-500 overflow-hidden">
      {/* Dynamic Style Injection */}
      <style>{customStyles}</style>

      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        status={status} 
      />
      <main className="flex-1 relative overflow-hidden bg-gradient-to-br from-transparent via-white/5 to-emerald-50/20 dark:from-zinc-900/50 dark:to-zinc-950">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;


import React, { useState, useEffect } from 'react';
import { pagiBridge } from '../services/pagiBridgeService';
import { 
  Cpu, 
  Palette, 
  ShieldCheck, 
  Save, 
  RotateCcw, 
  Command, 
  Globe, 
  Eye, 
  Layout, 
  Fingerprint,
  HardDrive,
  Moon,
  Sun,
  Monitor,
  Code2,
  Link,
  Image as ImageIcon,
  BrainCircuit,
  Sparkles,
  Zap,
  AlignLeft,
  Server,
  Shapes
} from 'lucide-react';

interface SettingsGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SettingsGroup: React.FC<SettingsGroupProps> = ({ title, icon, children }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
      <div className="text-emerald-500">{icon}</div>
      <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">{title}</h2>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

interface SettingItemProps {
  label: string;
  description: string;
  children: React.ReactNode;
  vertical?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({ label, description, children, vertical = false }) => (
  <div className={`flex ${vertical ? 'flex-col space-y-3' : 'flex-col sm:flex-row sm:items-center justify-between gap-4'} group`}>
    <div className="space-y-0.5">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{label}</h3>
      <p className="text-[11px] text-zinc-500 leading-relaxed max-w-sm">{description}</p>
    </div>
    <div className="flex-shrink-0">
      {children}
    </div>
  </div>
);

const SettingsView: React.FC = () => {
  const [isSaved, setIsSaved] = useState(false);
  const [config, setConfig] = useState({
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
    customCss: '/* Add your custom CSS here */\n\n/* Example: Change aura color */\n/* .aura-core { background: purple !important; } */',
    persona: 'professional',
    creativity: 0.7,
    thinkingBudget: 0,
    responseDepth: 0.5,
    customDirectives: '',
    verticalUseCase: 'research' as 'research' | 'codegen' | 'personal',
    userAlias: 'User',
    feature_flags: {
      personalHealth: false,
      personalFinance: false,
      personalSocial: false,
      personalEmail: false,
    },
    useMockModeForRlm: false,  // When false, send mock_mode: false to bridge so RLM uses real structured/LLM path
    sovereign: {
      fullAccess: false,
      projectRoot: '',
      allowOutbound: false,
      allowLocalDispatch: false,
      actionsViaGrpc: false,
      allowRealDispatch: false,
      verticalUseCase: 'personal' as 'research' | 'codegen' | 'code_review' | 'personal',
      alwaysOn: false,
      pushToBridgeOnSave: true,
    },
  });

  const handleSave = async () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    localStorage.setItem('phoenix_config', JSON.stringify(config));
    window.dispatchEvent(new Event('storage'));
    const sov = config.sovereign;
    if (sov?.pushToBridgeOnSave && config.bridgeUrl) {
      const overrides: Record<string, string | boolean> = {};
      if (sov.projectRoot !== undefined && sov.projectRoot !== '') overrides['PAGI_PROJECT_ROOT'] = sov.projectRoot;
      if (sov.allowOutbound !== undefined) overrides['PAGI_ALLOW_OUTBOUND'] = sov.allowOutbound;
      if (sov.allowLocalDispatch !== undefined) overrides['PAGI_ALLOW_LOCAL_DISPATCH'] = sov.allowLocalDispatch;
      if (sov.actionsViaGrpc !== undefined) overrides['PAGI_ACTIONS_VIA_GRPC'] = sov.actionsViaGrpc;
      if (sov.allowRealDispatch !== undefined) overrides['PAGI_ALLOW_REAL_DISPATCH'] = sov.allowRealDispatch;
      if (sov.verticalUseCase !== undefined) overrides['PAGI_VERTICAL_USE_CASE'] = sov.verticalUseCase;
      if (Object.keys(overrides).length > 0) {
        try {
          await pagiBridge.pushConfig(overrides);
        } catch (e) {
          console.warn('Could not push sovereign config to bridge (is PAGI_ALLOW_UI_CONFIG_OVERRIDE=true?)', e);
        }
      }
    }
  };

  const handleReset = () => {
    if (confirm('Reset system configuration to defaults?')) {
      const defaults = {
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
        customCss: '/* Add your custom CSS here */',
        persona: 'professional',
        creativity: 0.7,
        thinkingBudget: 0,
        responseDepth: 0.5,
        customDirectives: '',
        verticalUseCase: 'research',
        userAlias: 'User',
        feature_flags: {
          personalHealth: false,
          personalFinance: false,
          personalSocial: false,
          personalEmail: false,
        },
        useMockModeForRlm: false,
        sovereign: {
          fullAccess: false,
          projectRoot: '',
          allowOutbound: false,
          allowLocalDispatch: false,
          actionsViaGrpc: false,
          allowRealDispatch: false,
          verticalUseCase: 'personal',
          alwaysOn: false,
          pushToBridgeOnSave: true,
        },
      };
      setConfig(defaults);
      localStorage.setItem('phoenix_config', JSON.stringify(defaults));
      window.dispatchEvent(new Event('storage'));
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('phoenix_config');
    if (saved) {
      try {
        setConfig(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.error("Failed to load config", e);
      }
    }
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-10 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-16">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">System Configuration</h1>
            {isSaved && (
              <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full animate-in zoom-in-95 fade-in duration-300">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Applied</span>
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 uppercase tracking-[0.3em] font-medium">Node Environment & Core Protocols</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors uppercase tracking-widest"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-zinc-900/10 hover:scale-105 active:scale-95 transition-all"
          >
            <Save size={14} />
            Commit Changes
          </button>
        </div>
      </div>

      <div className="space-y-16 pb-20">
        {/* AGI Personality & Constraints */}
        <SettingsGroup title="AGI Personality & Constraints" icon={<BrainCircuit size={18} />}>
          <SettingItem 
            label="Operational Persona" 
            description="The high-level character profile of Sola's communicative layer (PAGI Core Sola)."
          >
            <select 
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={config.persona}
              onChange={(e) => setConfig({...config, persona: e.target.value})}
            >
              <option value="professional">Professional / Efficient</option>
              <option value="clinical">Clinical / Analytical</option>
              <option value="creative">Creative / Imaginative</option>
              <option value="empathetic">Empathetic / Supportive</option>
            </select>
          </SettingItem>

          <SettingItem 
            label="Inference Temperature" 
            description="Controls the randomness of the model. Lower values are more deterministic."
          >
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Stable</span>
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.05"
                className="w-32 accent-emerald-500"
                value={config.creativity}
                onChange={(e) => setConfig({...config, creativity: parseFloat(e.target.value)})}
              />
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Creative</span>
              <span className="text-[10px] font-mono text-emerald-500 font-bold w-8">{config.creativity.toFixed(2)}</span>
            </div>
          </SettingItem>

          <SettingItem 
            label="Thinking Budget" 
            description="The maximum number of tokens allocated for internal reasoning (Gemini 2.5/3 only)."
          >
            <div className="flex items-center gap-3">
               <input 
                type="number"
                min="0"
                max="32768"
                step="128"
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono w-32 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={config.thinkingBudget}
                onChange={(e) => setConfig({...config, thinkingBudget: parseInt(e.target.value) || 0})}
              />
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Tokens</span>
            </div>
          </SettingItem>

          <SettingItem 
            label="Response Depth" 
            description="Influences the Verbosity/Elaboration level of the generated responses."
          >
            <div className="flex items-center gap-4">
              <AlignLeft size={12} className="text-zinc-400" />
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1"
                className="w-32 accent-zinc-900 dark:accent-zinc-100"
                value={config.responseDepth}
                onChange={(e) => setConfig({...config, responseDepth: parseFloat(e.target.value)})}
              />
              <div className="flex flex-col">
                <div className="flex gap-0.5">
                  <AlignLeft size={10} className="text-zinc-400" />
                  <AlignLeft size={10} className="text-zinc-400" />
                </div>
              </div>
            </div>
          </SettingItem>

          <SettingItem 
            label="System Directives Override" 
            description="Custom instructions appended to the base PAGI Core Sola protocol."
            vertical
          >
            <div className="relative">
              <textarea 
                rows={4}
                placeholder="Example: Always end responses with a technical status code... "
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none no-scrollbar"
                value={config.customDirectives}
                onChange={(e) => setConfig({...config, customDirectives: e.target.value})}
              />
              <Sparkles size={14} className="absolute right-4 bottom-4 text-emerald-500/30 pointer-events-none" />
            </div>
          </SettingItem>
        </SettingsGroup>

        {/* Backend / Core Logic */}
        <SettingsGroup title="Core Orchestrator" icon={<Cpu size={18} />}>
          <SettingItem 
            label="API Key" 
            description="OpenRouter API key for chat and /llm-gateway. Sent to the bridge with each request; alternatively set PAGI_OPENROUTER_API_KEY in the bridge .env. Bridge must have PAGI_ALLOW_OUTBOUND=true."
          >
            <input 
              type="password"
              placeholder="••••••••••••••••"
              autoComplete="off"
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={config.apiKey === '••••••••••••••••' ? '' : config.apiKey}
              onChange={(e) => setConfig({...config, apiKey: e.target.value || '••••••••••••••••'})}
            />
          </SettingItem>

          <SettingItem 
            label="LLM Provider" 
            description="Select the infrastructure provider for LLM inference."
          >
            <select 
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={config.provider}
              onChange={(e) => {
                const newProvider = e.target.value;
                let newUrl = config.backendUrl;
                let newModel = config.model;
                if (newProvider === 'openrouter') {
                  newUrl = 'https://openrouter.ai/api/v1';
                  newModel = 'deepseek/deepseek-v3.2';
                } else if (newProvider === 'gemini') {
                  newUrl = '';
                  newModel = 'gemini-3-flash-preview';
                }
                setConfig({...config, provider: newProvider, backendUrl: newUrl, model: newModel});
              }}
            >
              <option value="openrouter">OpenRouter (Recommended)</option>
              <option value="gemini">Google Gemini (Native)</option>
              <option value="custom">Custom Gateway</option>
            </select>
          </SettingItem>

          <SettingItem 
            label="Inference Model" 
            description="Target model identifier within the selected provider's namespace."
          >
            {config.provider === 'openrouter' ? (
              <select 
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={config.model}
                onChange={(e) => setConfig({...config, model: e.target.value})}
              >
                <option value="deepseek/deepseek-v3.2">deepseek/deepseek-v3.2</option>
                <option value="anthropic/claude-3.5-sonnet">claude-3.5-sonnet</option>
                <option value="meta-llama/llama-3.1-405b">llama-3.1-405b</option>
              </select>
            ) : config.provider === 'gemini' ? (
              <select 
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={config.model}
                onChange={(e) => setConfig({...config, model: e.target.value})}
              >
                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                <option value="gemini-3-pro-preview">gemini-3-pro-preview</option>
              </select>
            ) : (
              <input 
                type="text"
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={config.model}
                onChange={(e) => setConfig({...config, model: e.target.value})}
              />
            )}
          </SettingItem>

          <SettingItem 
            label="LLM Backend Endpoint" 
            description="Sovereign mode: requests are sent to the local bridge. Direct provider endpoints are not used by the UI."
          >
            <div className="relative">
              <input 
                type="text"
                disabled={config.provider === 'gemini'}
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                value={config.backendUrl}
                onChange={(e) => setConfig({...config, backendUrl: e.target.value})}
              />
            </div>
          </SettingItem>

          <SettingItem 
            label="PAGI Bridge URL" 
            description="Local intelligence bridge for Registry, memory, and agent events (e.g. http://127.0.0.1:8001)."
          >
            <input 
              type="text"
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={config.bridgeUrl ?? 'http://127.0.0.1:8001'}
              onChange={(e) => setConfig({...config, bridgeUrl: e.target.value || 'http://127.0.0.1:8001'})}
            />
          </SettingItem>

          <SettingItem 
            label="Vertical use case" 
            description="RLM vertical: research (self-patch), codegen (AI codegen), code_review (review + tests), personal (web dev/coding, personal KB)."
          >
            <select 
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={config.verticalUseCase ?? 'research'}
              onChange={(e) => setConfig({...config, verticalUseCase: e.target.value as 'research' | 'codegen' | 'personal'})}
            >
              <option value="research">Research (self-patch)</option>
              <option value="codegen">Codegen</option>
              <option value="code_review">Code review</option>
              <option value="personal">Personal AGI</option>
            </select>
          </SettingItem>

          <SettingItem 
            label="Use mock mode for RLM" 
            description="Mock mode is OFF by default. Turn ON only for testing. When on, chat RLM requests use the deterministic mock response (no LLM/skills). When off, real structured RLM (and LLM if PAGI_ALLOW_OUTBOUND=true) is used; overrides bridge PAGI_MOCK_MODE for these requests."
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                className="rounded accent-emerald-500" 
                checked={config.useMockModeForRlm === true} 
                onChange={(e) => setConfig({...config, useMockModeForRlm: e.target.checked})} 
              />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Use mock (contract testing only)</span>
            </label>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Mock mode is OFF by default. Turn ON only for testing.</p>
          </SettingItem>

          <SettingItem 
            label="Personal feature toggles" 
            description="When vertical is Personal AGI, enable these sub-features (health/finance/social/email KBs and L5 skills). Sent as feature_flags to RLM."
          >
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-emerald-500" checked={config.feature_flags?.personalHealth ?? false} onChange={(e) => setConfig({...config, feature_flags: { ...(config.feature_flags ?? {}), personalHealth: e.target.checked }})} />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Health</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-emerald-500" checked={config.feature_flags?.personalFinance ?? false} onChange={(e) => setConfig({...config, feature_flags: { ...(config.feature_flags ?? {}), personalFinance: e.target.checked }})} />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Finance</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-emerald-500" checked={config.feature_flags?.personalSocial ?? false} onChange={(e) => setConfig({...config, feature_flags: { ...(config.feature_flags ?? {}), personalSocial: e.target.checked }})} />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Social</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-emerald-500" checked={config.feature_flags?.personalEmail ?? false} onChange={(e) => setConfig({...config, feature_flags: { ...(config.feature_flags ?? {}), personalEmail: e.target.checked }})} />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-emerald-500" checked={config.feature_flags?.personalCalendar ?? false} onChange={(e) => setConfig({...config, feature_flags: { ...(config.feature_flags ?? {}), personalCalendar: e.target.checked }})} />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Calendar</span>
              </label>
            </div>
          </SettingItem>

          <SettingItem 
            label="Sovereign / full-access" 
            description="Opt-in: file system, OS, network, outbound LLM, and skill execution. Use only on a trusted machine. Settings are saved here and optionally pushed to the bridge when you save (requires bridge PAGI_ALLOW_UI_CONFIG_OVERRIDE=true)."
            vertical
          >
            <div className="space-y-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 p-4">
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Enabling these removes safety guardrails. The agent can read/write files under project root and call external APIs.</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-amber-500" checked={config.sovereign?.fullAccess ?? false} onChange={(e) => setConfig({...config, sovereign: { ...(config.sovereign ?? {}), fullAccess: e.target.checked }})} />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Enable full-access profile</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-1">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 block mb-1">Project root (file system scope)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ./ or C:\ or /" 
                    className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={config.sovereign?.projectRoot ?? ''} 
                    onChange={(e) => setConfig({...config, sovereign: { ...(config.sovereign ?? {}), projectRoot: e.target.value }})} 
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded accent-emerald-500" checked={config.sovereign?.allowOutbound ?? false} onChange={(e) => setConfig({...config, sovereign: { ...(config.sovereign ?? {}), allowOutbound: e.target.checked }})} />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">Allow outbound (LLM/APIs)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded accent-emerald-500" checked={config.sovereign?.allowLocalDispatch ?? false} onChange={(e) => setConfig({...config, sovereign: { ...(config.sovereign ?? {}), allowLocalDispatch: e.target.checked }})} />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">Local dispatch (L5 skills)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded accent-emerald-500" checked={config.sovereign?.actionsViaGrpc ?? false} onChange={(e) => setConfig({...config, sovereign: { ...(config.sovereign ?? {}), actionsViaGrpc: e.target.checked }})} />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">Actions via gRPC</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded accent-emerald-500" checked={config.sovereign?.allowRealDispatch ?? false} onChange={(e) => setConfig({...config, sovereign: { ...(config.sovereign ?? {}), allowRealDispatch: e.target.checked }})} />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">Real dispatch (Rust)</span>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Vertical</span>
                  <select 
                    className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={config.sovereign?.verticalUseCase ?? 'personal'}
                    onChange={(e) => setConfig({...config, sovereign: { ...(config.sovereign ?? {}), verticalUseCase: e.target.value as 'research' | 'codegen' | 'code_review' | 'personal' }})}
                  >
                    <option value="research">Research</option>
                    <option value="codegen">Codegen</option>
                    <option value="code_review">Code review</option>
                    <option value="personal">Personal AGI</option>
                  </select>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded accent-emerald-500" checked={config.sovereign?.alwaysOn ?? false} onChange={(e) => setConfig({...config, sovereign: { ...(config.sovereign ?? {}), alwaysOn: e.target.checked }})} />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">Always on (use run-always-on)</span>
                  </label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded accent-emerald-500" checked={config.sovereign?.pushToBridgeOnSave ?? true} onChange={(e) => setConfig({...config, sovereign: { ...(config.sovereign ?? {}), pushToBridgeOnSave: e.target.checked }})} />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">Push to bridge on Save (needs PAGI_ALLOW_UI_CONFIG_OVERRIDE=true)</span>
                </label>
              </div>
            </div>
          </SettingItem>
        </SettingsGroup>

        {/* Branding & Identity */}
        <SettingsGroup title="Branding & Identity" icon={<Shapes size={18} />}>
          <SettingItem 
            label="User Alias" 
            description="What should Sola call you? Used in chat greetings and labels."
          >
            <input 
              type="text"
              placeholder="User"
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={config.userAlias ?? 'User'}
              onChange={(e) => setConfig({...config, userAlias: e.target.value || 'User'})}
            />
          </SettingItem>
          <SettingItem 
            label="Sola Logo" 
            description="Default logo shown in sidebar and chat. Replace with custom URL below to use your own."
            vertical
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center shrink-0">
                <img src="/sola-logo.svg" alt="Sola Logo" className="h-8 w-8 object-contain" />
              </div>
              <span className="text-[11px] text-zinc-500">Default (assets/sola-logo.svg). Custom URL below.</span>
            </div>
          </SettingItem>
          <SettingItem 
            label="Custom Logo URL" 
            description="Overwrite the default Sola logo with a custom image endpoint (optional)."
          >
            <div className="relative flex items-center">
              <input 
                type="text"
                placeholder="https://example.com/logo.png"
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={config.logoUrl}
                onChange={(e) => setConfig({...config, logoUrl: e.target.value})}
              />
              <ImageIcon size={14} className="absolute right-3 text-zinc-400 pointer-events-none" />
            </div>
          </SettingItem>

          <SettingItem 
            label="Custom Favicon URL" 
            description="Define the browser tab icon for this orchestrator node."
          >
            <div className="relative flex items-center">
              <input 
                type="text"
                placeholder="https://example.com/favicon.ico"
                className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={config.faviconUrl}
                onChange={(e) => setConfig({...config, faviconUrl: e.target.value})}
              />
              <Link size={14} className="absolute right-3 text-zinc-400 pointer-events-none" />
            </div>
          </SettingItem>
        </SettingsGroup>

        {/* Frontend / Interface */}
        <SettingsGroup title="Aesthetic Interface" icon={<Palette size={18} />}>
          <SettingItem 
            label="Visual Mode" 
            description="Toggle between system preference, professional light, or high-contrast dark."
          >
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
              <button 
                onClick={() => setConfig({...config, theme: 'light'})}
                className={`p-2 rounded-lg transition-all ${config.theme === 'light' ? 'bg-white shadow-sm text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                <Sun size={14} />
              </button>
              <button 
                onClick={() => setConfig({...config, theme: 'dark'})}
                className={`p-2 rounded-lg transition-all ${config.theme === 'dark' ? 'bg-zinc-900 shadow-sm text-emerald-400' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                <Moon size={14} />
              </button>
              <button 
                onClick={() => setConfig({...config, theme: 'system'})}
                className={`p-2 rounded-lg transition-all ${config.theme === 'system' ? 'bg-white dark:bg-zinc-700 shadow-sm text-emerald-500' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                <Monitor size={14} />
              </button>
            </div>
          </SettingItem>

          <SettingItem 
            label="Primary Accent" 
            description="Custom branding color for system-wide highlights."
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border border-zinc-200" style={{ backgroundColor: config.accentColor }} />
              <input 
                type="text" 
                className="bg-transparent border-none text-[11px] font-mono font-bold text-zinc-500 uppercase focus:ring-0 p-0 w-20"
                value={config.accentColor}
                onChange={(e) => setConfig({...config, accentColor: e.target.value})}
              />
            </div>
          </SettingItem>
        </SettingsGroup>

        {/* Developer Overrides */}
        <SettingsGroup title="Developer Overrides" icon={<Code2 size={18} />}>
          <SettingItem 
            label="Custom CSS injection" 
            description="Inject global styles directly into the orchestrator runtime."
            vertical
          >
            <textarea 
              rows={4}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none no-scrollbar"
              value={config.customCss}
              onChange={(e) => setConfig({...config, customCss: e.target.value})}
            />
          </SettingItem>
        </SettingsGroup>
      </div>

      <div className="mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-900 flex flex-col sm:flex-row justify-between gap-6 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
        <div className="flex items-center gap-4">
          <Fingerprint size={24} className="text-zinc-400" />
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Node ID: PAGI-ALPHA-01 // SIG: 0x82...f21
          </div>
        </div>
        <div className="flex gap-4">
          <Globe size={16} className="text-zinc-400" />
          <Eye size={16} className="text-zinc-400" />
          <HardDrive size={16} className="text-zinc-400" />
        </div>
      </div>
    </div>
  );
};

export default SettingsView;

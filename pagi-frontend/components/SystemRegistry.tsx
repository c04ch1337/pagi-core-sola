import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  BarChart3, 
  Download, 
  Filter, 
  Database, 
  Zap, 
  UserCircle, 
  Cpu, 
  CheckCircle2, 
  RefreshCcw, 
  XCircle,
  Eye,
  Terminal,
  RotateCw,
  Check,
  ShieldCheck,
  Activity,
  History,
  Info,
  ClipboardList,
  ChevronDown,
  ArrowUpDown,
  X,
  Calendar,
  Save,
  Layers,
  Trash2,
  FileText
} from 'lucide-react';
import { TelemetryRow, MemoryLayer, MemoryAccessResponse } from '../types';
import { pagiBridge } from '../services/pagiBridgeService';

interface FilterButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  activeColor?: string;
}

const FilterButton: React.FC<FilterButtonProps> = ({ label, isActive, onClick, icon, activeColor = 'bg-zinc-900' }) => {
  return (
    <button
      onClick={onClick}
      title={`Filter by ${label}`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all border uppercase tracking-widest ${
        isActive 
          ? `${activeColor} text-white border-transparent shadow-sm scale-105` 
          : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
      }`}
    >
      {icon && <span className={isActive ? 'text-white' : 'text-zinc-400'}>{icon}</span>}
      {label}
    </button>
  );
};

const ActionTooltip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="relative group/tooltip">
    {children}
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-[70] shadow-lg border border-white/10 dark:border-zinc-300 uppercase tracking-widest translate-y-1 group-hover/tooltip:translate-y-0 text-center">
      {label}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
    </div>
  </div>
);

const SystemRegistry: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [viewingComponent, setViewingComponent] = useState<TelemetryRow | null>(null);
  const [terminalComponent, setTerminalComponent] = useState<TelemetryRow | null>(null);
  const [memoryComponent, setMemoryComponent] = useState<TelemetryRow | null>(null);
  const [restartingIds, setRestartingIds] = useState<Set<string>>(new Set());
  
  // Memory Operation State
  const [selectedLayer, setSelectedLayer] = useState<MemoryLayer>(1);
  const [memoryPayload, setMemoryPayload] = useState('');
  const [memoryResponse, setMemoryResponse] = useState<MemoryAccessResponse | null>(null);
  const [isMemoryLoading, setIsMemoryLoading] = useState(false);

  // Date Filtering State
  const [dateRange, setDateRange] = useState<'all' | '24h' | '7d' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Persistence State
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);

  // Personal KB state (vertical: personal); tabs: Personal, Health, Finance, Social, Email, Calendar
  const [kbTab, setKbTab] = useState<'personal' | 'health' | 'finance' | 'social' | 'email' | 'calendar'>('personal');
  const [kbUploadText, setKbUploadText] = useState('');
  const [kbSearchQuery, setKbSearchQuery] = useState('');
  const [kbSearchHits, setKbSearchHits] = useState<Array<{ content?: string; score?: number; metadata?: Record<string, unknown> }>>([]);
  const [kbUploading, setKbUploading] = useState(false);
  const [kbSearching, setKbSearching] = useState(false);
  // Health tab: quick metrics (weight, steps) for Track button
  const [healthWeight, setHealthWeight] = useState('');
  const [healthSteps, setHealthSteps] = useState('');
  // Finance tab: quick transaction (amount, category, date) for Track button
  const [financeAmount, setFinanceAmount] = useState('');
  const [financeCategory, setFinanceCategory] = useState('');
  const [financeDate, setFinanceDate] = useState('');
  // Social tab: platform, action, summary for Track; trends/sentiment results
  const [socialPlatform, setSocialPlatform] = useState('');
  const [socialAction, setSocialAction] = useState('post');
  const [socialSummary, setSocialSummary] = useState('');
  const [socialTrendsResult, setSocialTrendsResult] = useState<string | null>(null);
  const [socialTrendsLoading, setSocialTrendsLoading] = useState(false);
  const [socialSentimentInput, setSocialSentimentInput] = useState('');
  const [socialSentimentResult, setSocialSentimentResult] = useState<string | null>(null);
  const [socialSentimentLoading, setSocialSentimentLoading] = useState(false);
  // Email tab: track event (action, subject, summary); history and draft results
  const [emailAction, setEmailAction] = useState('sent');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailSummary, setEmailSummary] = useState('');
  const [emailHistoryResult, setEmailHistoryResult] = useState<string | null>(null);
  const [emailHistoryLoading, setEmailHistoryLoading] = useState(false);
  const [emailDraftRecipient, setEmailDraftRecipient] = useState('');
  const [emailDraftSubject, setEmailDraftSubject] = useState('');
  const [emailDraftBody, setEmailDraftBody] = useState('');
  const [emailDraftResult, setEmailDraftResult] = useState<string | null>(null);
  const [emailDraftLoading, setEmailDraftLoading] = useState(false);
  // Calendar tab: event form and recent events
  const [calTitle, setCalTitle] = useState('');
  const [calStart, setCalStart] = useState('');
  const [calEnd, setCalEnd] = useState('');
  const [calRecurring, setCalRecurring] = useState('none');
  const [calReminder, setCalReminder] = useState('');
  const [calEventsHits, setCalEventsHits] = useState<Array<{ content?: string; score?: number }>>([]);
  const [calEventsLoading, setCalEventsLoading] = useState(false);

  const kbNameForTab = useMemo(() => {
    const map = { personal: 'kb_personal', health: 'kb_health', finance: 'kb_finance', social: 'kb_social', email: 'kb_email', calendar: 'kb_calendar' } as const;
    return map[kbTab];
  }, [kbTab]);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{key: keyof TelemetryRow, direction: 'asc' | 'desc'}>({ key: 'name', direction: 'asc' });

  // Load saved filters on mount
  useEffect(() => {
    const saved = localStorage.getItem('phoenix_registry_filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSearchTerm(parsed.searchTerm || '');
        setSelectedType(parsed.selectedType || null);
        setSelectedStatus(parsed.selectedStatus || null);
        setDateRange(parsed.dateRange || 'all');
        setCustomRange(parsed.customRange || { start: '', end: '' });
      } catch (e) {
        console.error("Failed to load registry filters", e);
      }
    }
  }, []);

  // Auto-save logic
  useEffect(() => {
    const filters = { searchTerm, selectedType, selectedStatus, dateRange, customRange };
    localStorage.setItem('phoenix_registry_filters', JSON.stringify(filters));
    
    // Show temporary visual indicator
    setShowSavedIndicator(true);
    const timer = setTimeout(() => setShowSavedIndicator(false), 2000);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedType, selectedStatus, dateRange, customRange]);

  // Reference date for simulation (May 12, 2025 at noon)
  const referenceDate = new Date('2025-05-12T12:00:00').getTime();

  const rawData: TelemetryRow[] = useMemo(() => [
    { name: 'Core.PAGI', version: '2.4.1', type: 'Logic Engine', status: 'online', latency: '4ms', lastPatch: '2025-05-12 04:22' },
    { name: 'KB.GlobalRegistry', version: '1.1.0', type: 'Knowledge Base', status: 'online', latency: '12ms', lastPatch: '2025-05-12 05:01' },
    { name: 'Skill.CodeAnalysis', version: '3.0.5', type: 'Skill', status: 'online', latency: '45ms', lastPatch: '2025-05-11 22:15' },
    { name: 'Skill.VisualSynthesis', version: '0.9.8', type: 'Skill', status: 'online', latency: '110ms', lastPatch: '2025-05-12 01:40' },
    { name: 'Agent.SecurityScrub', version: '1.2.3', type: 'Agent', status: 'optimizing', latency: '22ms', lastPatch: '2025-05-12 06:12' },
    { name: 'IO.WebInference', version: '2.0.0', type: 'Logic Engine', status: 'online', latency: '6ms', lastPatch: '2025-05-12 04:00' },
    { name: 'KB.FinancialData', version: '1.0.0', type: 'Knowledge Base', status: 'offline', latency: 'N/A', lastPatch: '2025-05-10 18:30' },
    { name: 'Skill.MathematicalReasoning', version: '4.2.1', type: 'Skill', status: 'online', latency: '33ms', lastPatch: '2025-05-12 03:55' },
  ], []);

  const handleRestart = (name: string) => {
    setRestartingIds(prev => new Set(prev).add(name));
    setTimeout(() => {
      setRestartingIds(prev => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }, 2000);
  };

  const parseLatency = (latency: string) => {
    if (latency === 'N/A') return Infinity;
    return parseInt(latency) || 0;
  };

  const filteredData = useMemo(() => {
    return rawData
      .filter((row) => {
        const matchesSearch = row.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = !selectedType || row.type === selectedType;
        const matchesStatus = !selectedStatus || row.status === selectedStatus;
        
        // Date Filtering Logic
        let matchesDate = true;
        const patchDate = new Date(row.lastPatch.replace(' ', 'T')).getTime();
        
        if (dateRange === '24h') {
          const oneDayAgo = referenceDate - (24 * 60 * 60 * 1000);
          matchesDate = patchDate >= oneDayAgo;
        } else if (dateRange === '7d') {
          const sevenDaysAgo = referenceDate - (7 * 24 * 60 * 60 * 1000);
          matchesDate = patchDate >= sevenDaysAgo;
        } else if (dateRange === 'custom') {
          if (customRange.start) {
            const start = new Date(customRange.start).getTime();
            matchesDate = matchesDate && patchDate >= start;
          }
          if (customRange.end) {
            const end = new Date(customRange.end).getTime() + (24 * 60 * 60 * 1000); // end of day
            matchesDate = matchesDate && patchDate <= end;
          }
        }

        return matchesSearch && matchesType && matchesStatus && matchesDate;
      })
      .map(row => restartingIds.has(row.name) ? { ...row, status: 'optimizing' as const } : row)
      .sort((a, b) => {
        let aVal: any = a[sortConfig.key];
        let bVal: any = b[sortConfig.key];
        
        if (sortConfig.key === 'latency') {
          aVal = parseLatency(a.latency);
          bVal = parseLatency(b.latency);
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [searchTerm, selectedType, selectedStatus, sortConfig, rawData, restartingIds, dateRange, customRange]);

  const typeConfig = [
    { label: 'Knowledge Base', icon: <Database size={14} />, color: 'blue', bgColor: 'bg-blue-600' },
    { label: 'Skill', icon: <Zap size={14} />, color: 'amber', bgColor: 'bg-amber-600' },
    { label: 'Agent', icon: <UserCircle size={14} />, color: 'indigo', bgColor: 'bg-indigo-600' },
    { label: 'Logic Engine', icon: <Cpu size={14} />, color: 'emerald', bgColor: 'bg-emerald-600' },
  ];

  const statusConfig = [
    { label: 'online', icon: <CheckCircle2 size={12} />, color: 'bg-emerald-500' },
    { label: 'optimizing', icon: <RefreshCcw size={12} />, color: 'bg-amber-500' },
    { label: 'offline', icon: <XCircle size={12} />, color: 'bg-rose-500' },
  ];

  const getLatencyColor = (latency: string) => {
    if (latency === 'N/A') return 'bg-zinc-200 dark:bg-zinc-800';
    const val = parseInt(latency);
    if (val < 20) return 'bg-emerald-500';
    if (val < 100) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const handleExportCSV = () => {
    const headers = ['Component Name', 'Version', 'Type', 'Status', 'Latency', 'Last Self-Patch'];
    const rows = filteredData.map(row => [
      `"${row.name}"`,
      `"${row.version}"`,
      `"${row.type}"`,
      `"${row.status}"`,
      `"${row.latency}"`,
      `"${row.lastPatch}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `telemetry_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleKbUpload = async () => {
    if (!kbUploadText.trim()) return;
    setKbUploading(true);
    try {
      if (kbTab === 'health') {
        let metrics: Record<string, unknown>;
        try {
          metrics = JSON.parse(kbUploadText.trim()) as Record<string, unknown>;
        } catch {
          metrics = { note: kbUploadText.trim() };
        }
        await pagiBridge.healthTrack(metrics);
      } else if (kbTab === 'finance') {
        let transactions: Record<string, unknown>[];
        try {
          const parsed = JSON.parse(kbUploadText.trim());
          transactions = Array.isArray(parsed) ? parsed : [parsed as Record<string, unknown>];
        } catch {
          transactions = [{ note: kbUploadText.trim() }];
        }
        await pagiBridge.financeTrack(transactions);
      } else {
        await pagiBridge.kbUpload(kbUploadText.trim(), kbNameForTab);
      }
      setKbUploadText('');
    } catch (err) {
      console.error('KB upload failed', err);
    } finally {
      setKbUploading(false);
    }
  };

  const handleKbSearch = async () => {
    if (!kbSearchQuery.trim()) return;
    setKbSearching(true);
    setKbSearchHits([]);
    try {
      if (kbTab === 'health') {
        const result = await pagiBridge.healthTrends(kbSearchQuery.trim(), 30);
        setKbSearchHits(result.trends ?? []);
      } else if (kbTab === 'finance') {
        const result = await pagiBridge.financeSummary(kbSearchQuery.trim(), 30);
        setKbSearchHits(result.summary ?? []);
      } else {
        const result = await pagiBridge.kbSearch(kbSearchQuery.trim(), kbNameForTab);
        setKbSearchHits(result.hits ?? []);
      }
    } catch (err) {
      console.error('KB search failed', err);
    } finally {
      setKbSearching(false);
    }
  };

  const handleMemoryOp = async (op: 'read' | 'write' | 'delete') => {
    if (!memoryComponent) return;
    setIsMemoryLoading(true);
    setMemoryResponse(null);
    try {
      const res = await pagiBridge.accessMemory({
        layer: selectedLayer,
        key: memoryComponent.name,
        operation: op,
        payload: op === 'write' ? memoryPayload : undefined
      });
      setMemoryResponse(res);
      if (op === 'read' && res.success && res.data) {
        setMemoryPayload(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2));
      }
    } catch (err) {
      console.error("Memory Access Failed", err);
      setMemoryResponse({
        success: false,
        layer: selectedLayer,
        latency_ms: 0
      });
    } finally {
      setIsMemoryLoading(false);
    }
  };

  const TerminalOverlay = () => {
    if (!terminalComponent) return null;
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setTerminalComponent(null)} />
        <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-3 border-b border-zinc-900 bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-emerald-500" />
              <span className="text-zinc-400">Terminal: {terminalComponent.name}</span>
            </div>
            <button onClick={() => setTerminalComponent(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
          </div>
          <div className="p-6 h-[300px] overflow-y-auto space-y-2">
            <p className="text-zinc-500">Initializing secure session with {terminalComponent.name}...</p>
            <p className="text-emerald-500">Handshake complete. Unit {terminalComponent.version} acknowledged.</p>
            <p className="text-zinc-300">$ fetch logs --tail 5</p>
            <p className="text-zinc-500 opacity-80">[04:22:15] LOG: Lifecycle check passed.</p>
            <p className="text-zinc-500 opacity-80">[04:22:18] LOG: Memory buffer stabilized.</p>
            <p className="text-zinc-500 opacity-80">[04:23:01] LOG: Optimizing inference path...</p>
            <p className="text-zinc-300 flex items-center gap-2">$ <span className="w-2 h-4 bg-emerald-500 animate-pulse"></span></p>
          </div>
        </div>
      </div>
    );
  };

  const MemoryOverlay = () => {
    if (!memoryComponent) return null;
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMemoryComponent(null)} />
        <div className="relative w-full max-w-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Memory Interface</h3>
                <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">PAGI Tiered Storage: {memoryComponent.name}</p>
              </div>
            </div>
            <button onClick={() => setMemoryComponent(null)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Select Layer (L1 - L7)</label>
              <div className="flex justify-between gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                {[1, 2, 3, 4, 5, 6, 7].map((l) => (
                  <button
                    key={l}
                    onClick={() => setSelectedLayer(l as MemoryLayer)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedLayer === l 
                        ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                    }`}
                  >
                    L{l}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Memory Payload</label>
                <button onClick={() => setMemoryPayload('')} className="text-[10px] text-zinc-400 hover:text-zinc-600 flex items-center gap-1 uppercase tracking-widest font-bold">
                  <RotateCw size={10} />
                  Clear
                </button>
              </div>
              <textarea 
                value={memoryPayload}
                onChange={(e) => setMemoryPayload(e.target.value)}
                placeholder="Data registers to write or search for..."
                className="w-full h-32 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none no-scrollbar"
              />
            </div>

            {memoryResponse && (
              <div className={`p-4 rounded-xl border flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
                memoryResponse.success ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50' : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/50'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {memoryResponse.success ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-rose-500" />}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${memoryResponse.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {memoryResponse.success ? 'Success' : 'Operation Denied'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-tighter">Latency: {memoryResponse.latency_ms}ms</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-900 flex justify-end gap-3">
             <button 
              onClick={() => handleMemoryOp('delete')}
              disabled={isMemoryLoading}
              className="px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              <Trash2 size={14} />
              Erase
            </button>
             <button 
              onClick={() => handleMemoryOp('read')}
              disabled={isMemoryLoading}
              className="px-6 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2"
            >
              {isMemoryLoading ? <RotateCw size={14} className="animate-spin" /> : <FileText size={14} />}
              Read Layer
            </button>
             <button 
              onClick={() => handleMemoryOp('write')}
              disabled={isMemoryLoading}
              className="px-6 py-2 bg-blue-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/10 flex items-center gap-2"
            >
              <Save size={14} />
              Commit To Layer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ComponentModal = () => {
    if (!viewingComponent) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setViewingComponent(null)} />
        <div className="relative w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{viewingComponent.name}</h3>
                <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Component Diagnostic</p>
              </div>
            </div>
            <button onClick={() => setViewingComponent(null)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Type</label>
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{viewingComponent.type}</div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Status</label>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${viewingComponent.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className="text-sm font-bold uppercase text-zinc-700 dark:text-zinc-300">{viewingComponent.status}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Latency</label>
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{viewingComponent.latency}</div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Last Patch</label>
                <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{viewingComponent.lastPatch}</div>
              </div>
            </div>
            <div className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Extended Telemetry</h4>
               <div className="space-y-3">
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Uptime Metric</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">99.982%</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Memory Pressure</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">1.24 GB / 4.00 GB</span>
                 </div>
               </div>
            </div>
          </div>
          <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-900 flex justify-end gap-3">
             <button onClick={() => setViewingComponent(null)} className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-800 transition-colors">Close</button>
             <button onClick={() => { handleRestart(viewingComponent.name); setViewingComponent(null); }} className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 transition-opacity">Restart Component</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full p-10 overflow-y-auto no-scrollbar bg-zinc-50/50 dark:bg-transparent">
      <ComponentModal />
      <TerminalOverlay />
      <MemoryOverlay />
      
      {/* Personal KB Integration: tabs (Health, Finance, Social, Email) + upload + search */}
      <div className="mb-6 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
          <Database size={14} />
          Personal KB Integration
        </h2>
        <div className="flex flex-wrap gap-2 mb-4 p-1 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 w-fit">
          {(['personal', 'health', 'finance', 'social', 'email', 'calendar'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setKbTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                kbTab === tab
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab === 'personal' ? 'Personal' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            {kbTab === 'health' && (
              <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Quick metrics (kb_health)</label>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="number"
                    placeholder="Weight (kg)"
                    value={healthWeight}
                    onChange={(e) => setHealthWeight(e.target.value)}
                    className="w-24 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Steps"
                    value={healthSteps}
                    onChange={(e) => setHealthSteps(e.target.value)}
                    className="w-24 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <button
                    onClick={async () => {
                      const metrics: Record<string, unknown> = {};
                      if (healthWeight.trim() !== '') metrics.weight = Number(healthWeight) || healthWeight;
                      if (healthSteps.trim() !== '') metrics.steps = Number(healthSteps) || healthSteps;
                      if (Object.keys(metrics).length === 0) return;
                      setKbUploading(true);
                      try {
                        await pagiBridge.healthTrack(metrics);
                        setHealthWeight('');
                        setHealthSteps('');
                      } catch (e) { console.error(e); }
                      finally { setKbUploading(false); }
                    }}
                    disabled={kbUploading || (healthWeight.trim() === '' && healthSteps.trim() === '')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {kbUploading ? <RotateCw size={12} className="animate-spin" /> : null}
                    Track
                  </button>
                </div>
              </div>
            )}
            {kbTab === 'finance' && (
              <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Quick transaction (kb_finance)</label>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Amount (e.g. -50)"
                    value={financeAmount}
                    onChange={(e) => setFinanceAmount(e.target.value)}
                    className="w-24 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Category"
                    value={financeCategory}
                    onChange={(e) => setFinanceCategory(e.target.value)}
                    className="w-24 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <input
                    type="date"
                    placeholder="Date"
                    value={financeDate}
                    onChange={(e) => setFinanceDate(e.target.value)}
                    className="w-32 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <button
                    onClick={async () => {
                      const amountVal = financeAmount.trim();
                      const categoryVal = financeCategory.trim();
                      if (!amountVal && !categoryVal) return;
                      const tx: Record<string, unknown> = {};
                      if (amountVal !== '') tx.amount = Number(amountVal) || amountVal;
                      if (categoryVal !== '') tx.category = categoryVal;
                      if (financeDate.trim() !== '') tx.date = financeDate.trim();
                      if (Object.keys(tx).length === 0) return;
                      setKbUploading(true);
                      try {
                        await pagiBridge.financeTrack([tx]);
                        setFinanceAmount('');
                        setFinanceCategory('');
                        setFinanceDate('');
                      } catch (e) { console.error(e); }
                      finally { setKbUploading(false); }
                    }}
                    disabled={kbUploading || (financeAmount.trim() === '' && financeCategory.trim() === '')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {kbUploading ? <RotateCw size={12} className="animate-spin" /> : null}
                    Track
                  </button>
                </div>
              </div>
            )}
            {kbTab === 'social' && (
              <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Log activity (kb_social)</label>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Platform (e.g. Twitter)"
                    value={socialPlatform}
                    onChange={(e) => setSocialPlatform(e.target.value)}
                    className="w-28 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <select
                    value={socialAction}
                    onChange={(e) => setSocialAction(e.target.value)}
                    className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  >
                    <option value="post">post</option>
                    <option value="like">like</option>
                    <option value="follow">follow</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Summary"
                    value={socialSummary}
                    onChange={(e) => setSocialSummary(e.target.value)}
                    className="flex-1 min-w-[120px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <button
                    onClick={async () => {
                      if (!socialPlatform.trim() || !socialSummary.trim()) return;
                      setKbUploading(true);
                      try {
                        await pagiBridge.socialTrack(socialPlatform.trim(), socialAction, socialSummary.trim());
                        setSocialPlatform('');
                        setSocialSummary('');
                      } catch (e) { console.error(e); }
                      finally { setKbUploading(false); }
                    }}
                    disabled={kbUploading || !socialPlatform.trim() || !socialSummary.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {kbUploading ? <RotateCw size={12} className="animate-spin" /> : null}
                    Track
                  </button>
                </div>
              </div>
            )}
            {kbTab === 'calendar' && (
              <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Add event (kb_calendar)</label>
                <div className="grid grid-cols-1 gap-2">
                  <input type="text" placeholder="Title" value={calTitle} onChange={(e) => setCalTitle(e.target.value)} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                  <div className="flex gap-2 flex-wrap">
                    <input type="datetime-local" placeholder="Start" value={calStart} onChange={(e) => setCalStart(e.target.value)} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                    <input type="datetime-local" placeholder="End" value={calEnd} onChange={(e) => setCalEnd(e.target.value)} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                  </div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <select value={calRecurring} onChange={(e) => setCalRecurring(e.target.value)} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                      <option value="none">none</option>
                      <option value="daily">daily</option>
                      <option value="weekly">weekly</option>
                    </select>
                    <input type="number" placeholder="Reminder (min)" value={calReminder} onChange={(e) => setCalReminder(e.target.value)} className="w-24 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                    <button
                      onClick={async () => {
                        if (!calTitle.trim() || !calStart || !calEnd) return;
                        setKbUploading(true);
                        try {
                          const payload: { title: string; start_time: string; end_time: string; recurring?: string; reminder_minutes?: number } = { title: calTitle.trim(), start_time: calStart, end_time: calEnd };
                          if (calRecurring !== 'none') payload.recurring = calRecurring;
                          if (calReminder.trim() !== '') payload.reminder_minutes = parseInt(calReminder, 10) || undefined;
                          await pagiBridge.calendarTrack(payload);
                          setCalTitle('');
                          setCalStart('');
                          setCalEnd('');
                          setCalReminder('');
                        } catch (e) { console.error(e); }
                        finally { setKbUploading(false); }
                      }}
                      disabled={kbUploading || !calTitle.trim() || !calStart || !calEnd}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {kbUploading ? <RotateCw size={12} className="animate-spin" /> : null}
                      Add Event
                    </button>
                  </div>
                </div>
              </div>
            )}
            {kbTab === 'email' && (
              <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Log email event (kb_email)</label>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={emailAction}
                    onChange={(e) => setEmailAction(e.target.value)}
                    className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  >
                    <option value="sent">sent</option>
                    <option value="received">received</option>
                    <option value="draft">draft</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="flex-1 min-w-[120px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Summary"
                    value={emailSummary}
                    onChange={(e) => setEmailSummary(e.target.value)}
                    className="flex-1 min-w-[100px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <button
                    onClick={async () => {
                      if (!emailSubject.trim() || !emailSummary.trim()) return;
                      setKbUploading(true);
                      try {
                        await pagiBridge.emailTrack({ action: emailAction, subject: emailSubject.trim(), summary: emailSummary.trim() });
                        setEmailSubject('');
                        setEmailSummary('');
                      } catch (e) { console.error(e); }
                      finally { setKbUploading(false); }
                    }}
                    disabled={kbUploading || !emailSubject.trim() || !emailSummary.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {kbUploading ? <RotateCw size={12} className="animate-spin" /> : null}
                    Track
                  </button>
                </div>
              </div>
            )}
            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Upload to {kbNameForTab}</label>
            <textarea
              value={kbUploadText}
              onChange={(e) => setKbUploadText(e.target.value)}
              placeholder={kbTab === 'health' ? 'Or paste JSON e.g. {"weight": 70, "steps": 5000}...' : kbTab === 'finance' ? 'Or paste JSON e.g. [{"amount": -50, "category": "food", "date": "2025-02-04"}]...' : kbTab === 'social' ? 'Or paste text to upsert into kb_social...' : kbTab === 'email' ? 'Or paste text to upsert into kb_email...' : kbTab === 'calendar' ? 'Or paste text to upsert into kb_calendar...' : 'Paste text to upsert into personal KB...'}
              className="w-full h-24 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-xs font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
            <button
              onClick={handleKbUpload}
              disabled={kbUploading || !kbUploadText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {kbUploading ? <RotateCw size={14} className="animate-spin" /> : <ArrowUpDown size={14} />}
              Upload
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Search {kbNameForTab}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={kbSearchQuery}
                onChange={(e) => setKbSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleKbSearch()}
                placeholder="Query for semantic search..."
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                onClick={handleKbSearch}
                disabled={kbSearching || !kbSearchQuery.trim()}
                className="px-4 py-2 bg-zinc-800 dark:bg-zinc-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
              >
                {kbSearching ? <RotateCw size={14} className="animate-spin" /> : <Search size={14} />}
                Search
              </button>
            </div>
            {kbSearchHits.length > 0 && (
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 p-2">
                {kbSearchHits.map((hit, i) => (
                  <div key={i} className="text-[11px] p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-700">
                    {hit.score != null && <span className="text-zinc-400 mr-2">score: {hit.score}</span>}
                    <span className="text-zinc-700 dark:text-zinc-300">{hit.content ?? JSON.stringify(hit.metadata ?? {})}</span>
                  </div>
                ))}
              </div>
            )}
            {kbTab === 'social' && (
              <div className="mt-4 space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Trends (query_social_trends)</label>
                  <button
                    onClick={async () => {
                      setSocialTrendsLoading(true);
                      setSocialTrendsResult(null);
                      try {
                        const r = await pagiBridge.socialTrends(30);
                        setSocialTrendsResult(typeof r.trends === 'string' ? r.trends : JSON.stringify(r.trends));
                      } catch (e) { setSocialTrendsResult(`Error: ${(e as Error).message}`); }
                      finally { setSocialTrendsLoading(false); }
                    }}
                    disabled={socialTrendsLoading}
                    className="mt-1 flex items-center gap-1 px-2 py-1 bg-zinc-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {socialTrendsLoading ? <RotateCw size={10} className="animate-spin" /> : null}
                    Load trends
                  </button>
                  {socialTrendsResult != null && (
                    <pre className="mt-2 p-2 text-[11px] bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{socialTrendsResult}</pre>
                  )}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Sentiment (social_sentiment)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="Content to analyze"
                      value={socialSentimentInput}
                      onChange={(e) => setSocialSentimentInput(e.target.value)}
                      className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (!socialSentimentInput.trim()) return;
                        setSocialSentimentLoading(true);
                        setSocialSentimentResult(null);
                        try {
                          const r = await pagiBridge.socialSentiment(socialSentimentInput.trim());
                          setSocialSentimentResult(r.result ?? '');
                        } catch (e) { setSocialSentimentResult(`Error: ${(e as Error).message}`); }
                        finally { setSocialSentimentLoading(false); }
                      }}
                      disabled={socialSentimentLoading || !socialSentimentInput.trim()}
                      className="px-2 py-1 bg-zinc-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {socialSentimentLoading ? <RotateCw size={10} className="animate-spin" /> : null}
                      Analyze
                    </button>
                  </div>
                  {socialSentimentResult != null && (
                    <p className="mt-2 text-[11px] text-zinc-700 dark:text-zinc-300">[social_sentiment] {socialSentimentResult}</p>
                  )}
                </div>
              </div>
            )}
            {kbTab === 'email' && (
              <div className="mt-4 space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">History (query_email_history)</label>
                  <button
                    onClick={async () => {
                      setEmailHistoryLoading(true);
                      setEmailHistoryResult(null);
                      try {
                        const r = await pagiBridge.emailHistory(30);
                        setEmailHistoryResult(typeof r.history === 'string' ? r.history : JSON.stringify(r.history));
                      } catch (e) { setEmailHistoryResult(`Error: ${(e as Error).message}`); }
                      finally { setEmailHistoryLoading(false); }
                    }}
                    disabled={emailHistoryLoading}
                    className="mt-1 flex items-center gap-1 px-2 py-1 bg-zinc-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {emailHistoryLoading ? <RotateCw size={10} className="animate-spin" /> : null}
                    Load history
                  </button>
                  {emailHistoryResult != null && (
                    <pre className="mt-2 p-2 text-[11px] bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{emailHistoryResult}</pre>
                  )}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Draft (email_draft)</label>
                  <div className="mt-1 space-y-1">
                    <input type="text" placeholder="Recipient" value={emailDraftRecipient} onChange={(e) => setEmailDraftRecipient(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                    <input type="text" placeholder="Subject" value={emailDraftSubject} onChange={(e) => setEmailDraftSubject(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                    <textarea placeholder="Body" value={emailDraftBody} onChange={(e) => setEmailDraftBody(e.target.value)} className="w-full h-16 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
                    <button
                      onClick={async () => {
                        if (!emailDraftRecipient.trim()) return;
                        setEmailDraftLoading(true);
                        setEmailDraftResult(null);
                        try {
                          const r = await pagiBridge.emailDraft(emailDraftRecipient.trim(), emailDraftSubject.trim(), emailDraftBody.trim());
                          setEmailDraftResult(r.message ?? '');
                        } catch (e) { setEmailDraftResult(`Error: ${(e as Error).message}`); }
                        finally { setEmailDraftLoading(false); }
                      }}
                      disabled={emailDraftLoading || !emailDraftRecipient.trim()}
                      className="flex items-center gap-1 px-2 py-1 bg-zinc-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {emailDraftLoading ? <RotateCw size={10} className="animate-spin" /> : null}
                      Generate draft
                    </button>
                  </div>
                  {emailDraftResult != null && (
                    <p className="mt-2 text-[11px] text-zinc-700 dark:text-zinc-300">{emailDraftResult}</p>
                  )}
                </div>
              </div>
            )}
            {kbTab === 'calendar' && (
              <div className="mt-4 space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Recent events (kb_calendar)</label>
                  <button
                    onClick={async () => {
                      setCalEventsLoading(true);
                      setCalEventsHits([]);
                      try {
                        const r = await pagiBridge.calendarSearch('events calendar');
                        setCalEventsHits(r.hits ?? []);
                      } catch (e) { console.error(e); }
                      finally { setCalEventsLoading(false); }
                    }}
                    disabled={calEventsLoading}
                    className="mt-1 flex items-center gap-1 px-2 py-1 bg-zinc-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {calEventsLoading ? <RotateCw size={10} className="animate-spin" /> : null}
                    Load events
                  </button>
                  {calEventsHits.length > 0 && (
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                      {calEventsHits.map((hit, i) => (
                        <div key={i} className="text-[11px] p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
                          {hit.score != null && <span className="text-zinc-400 mr-2">score: {hit.score}</span>}
                          {hit.content ?? ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">System Registry</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-[0.2em] font-medium">Orchestrator Telemetry & Unit Lifecycle</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-xs group">
            <Search size={16} className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-500 translate-y-2.5 transition-colors" />
            <input
              type="text"
              placeholder="Query components..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Save Status Indicator */}
            <div className={`absolute -top-6 right-0 flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase tracking-widest transition-all duration-300 ${showSavedIndicator ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
              <Check size={10} />
              <span>Saved</span>
            </div>

            <ActionTooltip label="Persist Current View State">
              <button
                className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 hover:text-emerald-500 transition-all shadow-sm active:scale-95"
              >
                <Save size={16} />
              </button>
            </ActionTooltip>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <FilterButton label="All" isActive={selectedType === null} onClick={() => setSelectedType(null)} />
            {typeConfig.map(t => (
              <FilterButton key={t.label} label={t.label} icon={t.icon} isActive={selectedType === t.label} onClick={() => setSelectedType(t.label)} activeColor={t.bgColor} />
            ))}
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-2" />
            <FilterButton label="All Status" isActive={selectedStatus === null} onClick={() => setSelectedStatus(null)} />
            {statusConfig.map(s => (
              <FilterButton key={s.label} label={s.label} icon={s.icon} isActive={selectedStatus === s.label} onClick={() => setSelectedStatus(s.label)} activeColor={s.color} />
            ))}
          </div>

          {/* Latency Legend */}
          <div className="flex items-center gap-6 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Optimal (&lt;20ms)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Nominal (&lt;100ms)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">High (100ms+)</span>
            </div>
          </div>
        </div>

        {/* Date Range Picker Row */}
        <div className="flex flex-wrap items-center gap-3 mt-1 py-1.5 px-2 bg-white/40 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 w-fit">
          <div className="flex items-center gap-2 px-2 text-zinc-400">
            <Calendar size={12} />
            <span className="text-[9px] font-black uppercase tracking-widest">Patch Range</span>
          </div>
          <FilterButton label="All Time" isActive={dateRange === 'all'} onClick={() => setDateRange('all')} />
          <FilterButton label="Last 24 Hours" isActive={dateRange === '24h'} onClick={() => setDateRange('24h')} />
          <FilterButton label="Last 7 Days" isActive={dateRange === '7d'} onClick={() => setDateRange('7d')} />
          <FilterButton label="Custom Range" isActive={dateRange === 'custom'} onClick={() => setDateRange('custom')} />
          
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 ml-2 animate-in slide-in-from-left-2 duration-300">
              <input 
                type="date" 
                value={customRange.start} 
                onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
                className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-[10px] font-mono focus:ring-1 focus:ring-emerald-500/30 focus:outline-none"
              />
              <span className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">to</span>
              <input 
                type="date" 
                value={customRange.end} 
                onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
                className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-[10px] font-mono focus:ring-1 focus:ring-emerald-500/30 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mb-10 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-800/30">
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800">Identifier</th>
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800">Version</th>
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800">Categorization</th>
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800">
                  <ActionTooltip label="Latency (ms): Optimal < 20ms, Nominal < 100ms, High 100ms+">
                    <span className="cursor-help border-b border-dotted border-zinc-300 dark:border-zinc-700">Latency</span>
                  </ActionTooltip>
                </th>
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredData.length > 0 ? (
                filteredData.map((row, idx) => {
                  const typeInfo = typeConfig.find(t => t.label === row.type) || typeConfig[0];
                  return (
                    <tr key={idx} role="row" className="group hover:bg-zinc-100/30 dark:hover:bg-zinc-800/30 transition-all duration-300">
                      <td className="px-6 py-4 text-sm font-semibold mono text-zinc-900 dark:text-zinc-100">{row.name}</td>
                      <td className="px-6 py-4 text-xs mono text-zinc-400 font-medium">v{row.version}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{React.cloneElement(typeInfo.icon as React.ReactElement, { size: 12 })}</span>
                          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{row.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${row.status === 'online' ? 'bg-emerald-500 animate-pulse' : row.status === 'optimizing' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${row.status === 'online' ? 'text-emerald-600' : 'text-zinc-500'}`}>{row.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs mono font-medium text-zinc-700 dark:text-zinc-300">{row.latency}</span>
                          {row.latency !== 'N/A' && (
                            <div className="w-12 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className={`h-full ${getLatencyColor(row.latency)}`} style={{ width: `${Math.min(parseInt(row.latency) / 2, 100)}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300 ease-out">
                          <ActionTooltip label="View Details">
                            <button title="View Details" onClick={() => setViewingComponent(row)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                              <Eye size={14} />
                            </button>
                          </ActionTooltip>
                          <ActionTooltip label="Restart Unit">
                            <button 
                              title="Restart Unit"
                              onClick={() => handleRestart(row.name)}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-amber-500 transition-colors ${restartingIds.has(row.name) ? 'animate-spin text-amber-500' : ''}`}
                            >
                              <RotateCw size={14} />
                            </button>
                          </ActionTooltip>
                          <ActionTooltip label="Internal Terminal">
                            <button title="Internal Terminal" onClick={() => setTerminalComponent(row)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 transition-colors">
                              <Terminal size={14} />
                            </button>
                          </ActionTooltip>
                          <ActionTooltip label="Memory Access (L1-L7)">
                            <button title="Memory Access" onClick={() => { setMemoryComponent(row); setMemoryResponse(null); setMemoryPayload(''); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-emerald-500 transition-colors">
                              <Layers size={14} />
                            </button>
                          </ActionTooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">No telemetry data found for the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-auto border-t border-zinc-200 dark:border-zinc-800 pt-8 flex justify-between items-center text-[10px] uppercase tracking-[0.3em] text-zinc-400 font-bold">
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
            <span className="text-zinc-300">Active Units:</span>
            <span className="text-emerald-500">{rawData.filter(d => d.status === 'online').length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span>System Integral</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
      </div>
    </div>
  );
};

export default SystemRegistry;


import React, { useState } from 'react';
import { 
  RefreshCw, 
  AlertCircle, 
  Loader2, 
  Plus, 
  Layers, 
  Calendar, 
  ArrowUpRight,
  MoreVertical,
  Activity,
  FileCode,
  Brain,
  X
} from 'lucide-react';
import { ProjectContext } from '../types';

type SyncStatus = 'offline' | 'syncing' | 'synced' | 'failed';

const ProjectsView: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [projects, setProjects] = useState<ProjectContext[]>([
    { id: '1', title: 'Global Registry Sync', description: 'Handshake protocol with the global knowledge base for real-time indexing.', isActive: true },
    { id: '2', title: 'Logic Engine v4', description: 'Inference optimization for deep reasoning and multi-step planning sequences.', isActive: false },
    { id: '3', title: 'Semantic Memory Alpha', description: 'Vector-based retrieval system for persistent long-term context storage.', isActive: false },
    { id: '4', title: 'Neural Aesthetics', description: 'Vision-tuned models for evaluating UI/UX somatic calm principles.', isActive: false },
    { id: '5', title: 'Code Synthesis Pro', description: 'Specialized skill-set for generating high-performance React architectures.', isActive: false },
  ]);

  const handleResync = () => {
    setSyncStatus('syncing');
    setTimeout(() => {
      setSyncStatus('synced');
    }, 1500);
  };

  const openAddProject = () => {
    setNewProjectTitle('');
    setNewProjectDescription('');
    setShowAddModal(true);
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;
    setProjects(prev => [
      ...prev,
      {
        id: String(Date.now()),
        title: newProjectTitle.trim(),
        description: newProjectDescription.trim(),
        isActive: false
      }
    ]);
    setShowAddModal(false);
  };

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing': return <Loader2 size={12} className="animate-spin text-emerald-500" />;
      case 'failed': return <AlertCircle size={12} className="text-rose-500" />;
      case 'synced': return <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />;
      default: return <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full p-10 animate-in fade-in duration-700 max-w-6xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">Project Workspace</h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-400">Contextual Archives</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              {getSyncIcon()}
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{syncStatus}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResync}
            className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all active:scale-95"
            title="Force Resync"
          >
            <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAddProject}
            className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-zinc-900/10 hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus size={14} strokeWidth={3} />
            Initialize Project
          </button>
        </div>
      </div>

      {/* Grid of project cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div 
            key={project.id}
            className="group relative flex flex-col p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 hover:-translate-y-1"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${project.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'} transition-colors`}>
                <Layers size={20} />
              </div>
              <button className="p-2 text-zinc-300 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors">
                <MoreVertical size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 transition-colors">
                {project.title}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                {project.description}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                  <Activity size={10} />
                  {project.isActive ? 'Active' : 'Standby'}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                  <Calendar size={10} />
                  May 12
                </div>
              </div>
              <button className="p-1.5 rounded-lg text-zinc-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0">
                <ArrowUpRight size={18} />
              </button>
            </div>
            
            {project.isActive && (
              <div className="absolute top-4 right-14 flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-tighter">Mounted</span>
              </div>
            )}
          </div>
        ))}

        {/* Create new archive card */}
        <button
          onClick={openAddProject}
          className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl group hover:border-emerald-500/30 transition-all hover:bg-emerald-500/[0.02]"
        >
          <div className="p-4 rounded-full bg-zinc-50 dark:bg-zinc-900 text-zinc-300 group-hover:text-emerald-500 transition-colors mb-4">
            <Plus size={24} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-emerald-600 transition-colors">Create New Archive</span>
        </button>
      </div>

      {/* Add Project modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">New Project Archive</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1.5">Title</label>
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="Project name"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1.5">Description (optional)</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Brief description"
                  rows={2}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 uppercase tracking-widest">
                  Cancel
                </button>
                <button type="submit" disabled={!newProjectTitle.trim()} className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-black uppercase tracking-widest rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                  Add Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary Footer */}
      <div className="mt-auto pt-16 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 hover:opacity-100 transition-opacity duration-700">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-zinc-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Storage: 4.2 GB / 128 GB</span>
          </div>
          <div className="flex items-center gap-2">
            <FileCode size={16} className="text-zinc-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Schema: PAGI-V1</span>
          </div>
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 italic">
          Node: PAGI-CENTRAL-01 // Protocol: RESTRICTED-V4
        </div>
      </div>
    </div>
  );
};

export default ProjectsView;

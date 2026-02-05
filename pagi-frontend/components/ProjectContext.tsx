
import React from 'react';
import { Layers, Plus, Database } from 'lucide-react';
import { ProjectContext as ProjectContextType } from '../types';

interface ProjectContextProps {
  activeProjects: ProjectContextType[];
}

const ProjectContext: React.FC<ProjectContextProps> = ({ activeProjects }) => {
  return (
    <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar animate-in fade-in slide-in-from-bottom-1 duration-500">
      {activeProjects.map((project) => (
        <div 
          key={project.id}
          className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 bg-zinc-100/80 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-full group cursor-default"
        >
          <div className="w-4 h-4 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Database size={10} />
          </div>
          <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-tight whitespace-nowrap">
            {project.title}
          </span>
          <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
        </div>
      ))}
      
      <button 
        title="Inject Knowledge Base"
        className="flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all bg-white/50 dark:bg-transparent"
      >
        <Plus size={12} />
      </button>
    </div>
  );
};

export default ProjectContext;

import React from 'react';
import { Users, Zap, Settings, LayoutGrid, Clock, UserCog, ClipboardList } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'team-builder', label: '专家团组建', icon: <Users size={20} /> },
    { id: 'team-tasks', label: '团队任务', icon: <ClipboardList size={20} /> },
    { id: 'expert-manager', label: '专家管理', icon: <UserCog size={20} /> },
    { id: 'arena', label: '赛马模式', icon: <Zap size={20} /> },
    { id: 'history', label: '历史项目', icon: <Clock size={20} /> },
    { id: 'admin', label: '模型管理', icon: <Settings size={20} /> },
  ];

  return (
    <div className="w-20 lg:w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-20 transition-all duration-300 shadow-sm">
      <div className="p-6 flex items-center justify-center lg:justify-start gap-3 border-b border-gray-100">
        <LayoutGrid className="text-blue-600" size={28} />
        <span className="text-xl font-bold text-gray-900 hidden lg:block">ExpertMinds</span>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors font-medium ${
              activeTab === item.id 
                ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {item.icon}
            <span className="hidden lg:block">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="text-xs text-gray-400 hidden lg:block text-center">
          v1.2.0 Beta
        </div>
      </div>
    </div>
  );
};
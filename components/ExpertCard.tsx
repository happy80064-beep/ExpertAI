import React from 'react';
import { Expert } from '../types';
import { Plus, X } from 'lucide-react';

interface ExpertCardProps {
  expert: Expert;
  isSelected: boolean;
  onToggle: (expert: Expert) => void;
}

export const ExpertCard: React.FC<ExpertCardProps> = ({ expert, isSelected, onToggle }) => {
  return (
    <div 
      className={`relative group rounded-xl p-4 border cursor-pointer transform transition-all duration-300 ease-out ${
        isSelected 
          ? 'bg-blue-50 border-blue-400 shadow-md shadow-blue-100 scale-[1.02] ring-1 ring-blue-300' 
          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-[1.01]'
      }`}
      onClick={() => onToggle(expert)}
    >
      <div className="flex items-start gap-4">
        <img 
          src={expert.avatar} 
          alt={expert.name} 
          className={`w-12 h-12 rounded-full border-2 object-cover transition-colors duration-300 ${isSelected ? 'border-blue-500' : 'border-gray-200'}`}
        />
        <div className="flex-1">
          <h3 className={`font-semibold leading-tight transition-colors duration-300 ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
            {expert.name}
          </h3>
          <span className={`inline-block px-2 py-0.5 mt-1 text-xs font-medium rounded-full border transition-colors duration-300 ${
            isSelected 
              ? 'bg-blue-100 text-blue-700 border-blue-200' 
              : 'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
            {expert.role}
          </span>
        </div>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
          isSelected 
            ? 'bg-blue-600 text-white rotate-0' 
            : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200 rotate-90'
        }`}>
          {isSelected ? <X size={14} /> : <Plus size={14} />}
        </div>
      </div>
      
      <p className="mt-3 text-xs text-gray-500 line-clamp-3 leading-relaxed">
        {expert.description}
      </p>

      {expert.isCustom && (
        <span className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full animate-pulse" title="自定义 AI 生成的专家"></span>
      )}
    </div>
  );
};
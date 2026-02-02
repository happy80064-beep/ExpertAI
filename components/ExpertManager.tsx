import React, { useState } from 'react';
import { Expert } from '../types';
import { Pencil, Upload, User, Save, X } from 'lucide-react';

interface ExpertManagerProps {
  experts: Expert[];
  onUpdateExpert: (expert: Expert) => void;
}

export const ExpertManager: React.FC<ExpertManagerProps> = ({ experts, onUpdateExpert }) => {
  const [editingExpert, setEditingExpert] = useState<Expert | null>(null);
  
  // Local state for the edit form
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAvatar, setEditAvatar] = useState('');

  const handleEditClick = (expert: Expert) => {
    setEditingExpert(expert);
    setEditName(expert.name);
    setEditDesc(expert.description);
    setEditAvatar(expert.avatar);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!editingExpert) return;

    const updatedExpert = {
      ...editingExpert,
      name: editName,
      description: editDesc,
      avatar: editAvatar,
      isCustom: true // Mark as custom if modified
    };

    onUpdateExpert(updatedExpert);
    setEditingExpert(null);
  };

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <User className="text-blue-600" /> 专家角色管理
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-10">
        {experts.map(expert => (
          <div key={expert.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4 group hover:border-blue-300 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <img 
                  src={expert.avatar} 
                  alt={expert.name} 
                  className="w-14 h-14 rounded-full border border-gray-200 object-cover"
                />
                <div>
                  <h3 className="font-bold text-gray-900">{expert.name}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                    {expert.role}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => handleEditClick(expert)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="修改专家信息"
              >
                <Pencil size={18} />
              </button>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex-1">
              <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed">
                {expert.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingExpert && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-gray-200 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">修改专家信息</h3>
              <button onClick={() => setEditingExpert(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Avatar Edit */}
              <div className="flex justify-center">
                <div className="relative group cursor-pointer">
                   <img 
                      src={editAvatar} 
                      alt="Avatar" 
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md group-hover:brightness-75 transition-all" 
                   />
                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="text-white w-8 h-8" />
                   </div>
                   <input 
                      type="file" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      accept="image/*"
                      onChange={handleAvatarUpload}
                   />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">人设 / 提示词</label>
                <textarea 
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-900 h-32 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setEditingExpert(null)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md flex items-center justify-center gap-2 transition-colors"
                >
                  <Save size={18} /> 保存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
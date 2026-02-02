import React, { useState } from 'react';
import { Expert, AIModelConfig, AnalysisResult, ExpertRole } from '../types';
import { ExpertCard } from './ExpertCard';
import { generateExpertPersona, runTeamAnalysis, extractContentFromFile } from '../services/aiService';
import { Play, PlusCircle, Bot, Loader2, Users, FileText, Image as ImageIcon, FileUp, Upload, X } from 'lucide-react';

interface TeamBuilderProps {
  availableExperts: Expert[];
  setAvailableExperts: React.Dispatch<React.SetStateAction<Expert[]>>;
  team: Expert[];
  setTeam: React.Dispatch<React.SetStateAction<Expert[]>>;
  models: AIModelConfig[];
  projectDescription: string;
  setProjectDescription: (text: string) => void;
  onAnalysisComplete: (result: AnalysisResult) => void;
}

const ROLES: ExpertRole[] = ['商业咨询', '财务融资', '风险投资', '运营操盘', '法律合规', '技术开发', '工程建设', '市场营销'];

export const TeamBuilder: React.FC<TeamBuilderProps> = ({
  availableExperts,
  setAvailableExperts,
  team,
  setTeam,
  models,
  projectDescription,
  setProjectDescription,
  onAnalysisComplete
}) => {
  const [selectedModelId, setSelectedModelId] = useState<string>(models[0]?.id || '');
  const [isGeneratingExpert, setIsGeneratingExpert] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImportingFile, setIsImportingFile] = useState(false);
  
  // Create Expert State
  const [newExpertRole, setNewExpertRole] = useState<ExpertRole>('商业咨询');
  const [newExpertName, setNewExpertName] = useState('');
  const [newExpertPrompt, setNewExpertPrompt] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Filter State
  const [activeFilter, setActiveFilter] = useState<string>('全部');

  const handleToggleExpert = (expert: Expert) => {
    if (team.find(e => e.id === expert.id)) {
      setTeam(team.filter(e => e.id !== expert.id));
    } else {
      setTeam([...team, expert]);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateExpert = async () => {
    setIsGeneratingExpert(true);
    try {
      const newExpert = await generateExpertPersona(
          newExpertRole, 
          newExpertPrompt, 
          avatarPreview || undefined,
          newExpertName || undefined
      );
      setAvailableExperts([newExpert, ...availableExperts]);
      setShowCreateModal(false);
      
      // Reset Form
      setNewExpertPrompt('');
      setNewExpertName('');
      setAvatarPreview(null);
    } catch (error) {
      console.error(error);
      alert('生成专家失败，请检查 API Key。');
    } finally {
      setIsGeneratingExpert(false);
    }
  };

  const handleAnalyze = async () => {
    if (team.length === 0) return alert("请至少选择一位专家。");
    if (!projectDescription.trim()) return alert("请输入项目描述。");

    setIsAnalyzing(true);
    try {
      // Find the full model config object
      const selectedModel = models.find(m => m.id === selectedModelId);
      if (!selectedModel) return;

      const result = await runTeamAnalysis(
        projectDescription, 
        team, 
        selectedModel // Pass full config including API key/url
      );
      onAnalysisComplete(result);
    } catch (error) {
      console.error(error);
      alert("分析失败，请查看控制台日志或检查模型 API 配置。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImportingFile(true);
    try {
      // Find currently selected model to try and use its key if it's Google
      const selectedModel = models.find(m => m.id === selectedModelId);
      
      const text = await extractContentFromFile(file, selectedModel);
      setProjectDescription(prev => (prev ? prev + '\n\n' + text : text));
    } catch (error: any) {
      console.error(error);
      alert(`文件解析失败: ${error.message || '请确保文件格式正确'}`);
    } finally {
      setIsImportingFile(false);
      // Reset input value so same file can be selected again if needed
      e.target.value = '';
    }
  };
  
  const filteredExperts = availableExperts.filter(expert => 
    activeFilter === '全部' ? true : expert.role === activeFilter
  );

  return (
    <div className="flex flex-col h-full gap-6">
      
      {/* Top Bar: Team Stats & Action */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="bg-blue-50 p-3 rounded-full text-blue-600">
              <UsersIcon count={team.length} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">专家委员会</h2>
              <p className="text-sm text-gray-500">
                {team.length === 0 ? "请选择专家开始" : `已选择 ${team.length} 位专家`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select 
              className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-4 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full md:w-48"
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
            >
              {models.filter(m => m.isEnabled).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing || team.length === 0}
              className={`flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all shadow-md ${
                isAnalyzing || team.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
              }`}
            >
              {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
              开始分析
            </button>
          </div>
        </div>

        {/* Selected Experts Bubbles */}
        {team.length > 0 && (
           <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 animate-fadeIn">
              {team.map(member => (
                 <div 
                   key={member.id}
                   className="flex items-center gap-2 pl-1.5 pr-2 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full text-sm group hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors select-none"
                 >
                    <img src={member.avatar} alt={member.name} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" />
                    <span className="font-medium">{member.name}</span>
                    <button 
                       onClick={() => handleToggleExpert(member)}
                       className="w-5 h-5 ml-1 rounded-full flex items-center justify-center bg-blue-100 text-blue-500 hover:bg-red-200 hover:text-red-600 transition-colors"
                       title="移除专家"
                    >
                       <X size={12} strokeWidth={3} />
                    </button>
                 </div>
              ))}
           </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Left: Experts Library */}
        <div className="lg:w-1/2 flex flex-col gap-4 min-h-0">
           <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-700">可用专家库</h3>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="text-xs flex items-center gap-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 px-3 py-1 rounded-full transition-colors"
              >
                <PlusCircle size={14} /> 创建 AI 专家
              </button>
           </div>
           
           {/* Filters */}
           <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {['全部', ...ROLES].map(role => (
                <button
                   key={role}
                   onClick={() => setActiveFilter(role)}
                   className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                     activeFilter === role
                       ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                       : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                   }`}
                >
                  {role}
                </button>
              ))}
           </div>
           
           <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-3 pb-20">
             {filteredExperts.map(expert => (
               <ExpertCard 
                 key={expert.id} 
                 expert={expert} 
                 isSelected={team.some(e => e.id === expert.id)} 
                 onToggle={handleToggleExpert} 
               />
             ))}
             {filteredExperts.length === 0 && (
                <div className="col-span-full py-8 text-center text-gray-400 text-sm">
                   该分类下暂无专家
                </div>
             )}
           </div>
        </div>

        {/* Right: Project Input */}
        <div className="lg:w-1/2 flex flex-col gap-4">
          <h3 className="font-semibold text-gray-700">项目背景</h3>
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col relative group focus-within:ring-2 focus-within:ring-blue-100 transition-shadow">
            {isImportingFile && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 rounded-xl flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                <p className="text-gray-900 font-medium">正在 AI 智能识别文档内容...</p>
                <p className="text-xs text-gray-500 mt-1">支持图片 OCR 和 PDF 解析</p>
              </div>
            )}
            
            <textarea
              className="flex-1 bg-transparent text-gray-800 outline-none resize-none placeholder-gray-400"
              placeholder="在此粘贴您的项目描述、商业计划书或想法... 描述越详细，分析效果越好。"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
            
            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
               <label className={`flex items-center gap-2 text-sm transition-colors cursor-pointer ${isImportingFile ? 'opacity-50 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}`}>
                 <input 
                   type="file" 
                   className="hidden" 
                   accept=".txt,.md,.doc,.docx,.pdf,image/png,image/jpeg,image/webp" 
                   onChange={handleFileUpload}
                   disabled={isImportingFile}
                 />
                 <div className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200">
                    <FileUp size={16} />
                    <span className="font-medium">导入文档/图片</span>
                 </div>
               </label>
               <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><FileText size={12}/> Word/PDF/MD</span>
                  <span className="flex items-center gap-1"><ImageIcon size={12}/> 图片</span>
                  <span>{projectDescription.length} 字符</span>
               </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal for Creating Expert */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-gray-200 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">创建虚拟专家</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><Bot /></button>
            </div>
            
            <div className="space-y-4">
              {/* Avatar Upload */}
              <div>
                 <label className="block text-sm text-gray-500 mb-2">专家头像 (可选)</label>
                 <div className="flex items-center gap-4">
                   <div className="relative w-16 h-16 rounded-full overflow-hidden border border-gray-300 bg-gray-50 flex items-center justify-center group cursor-pointer hover:border-blue-400 transition-colors">
                     {avatarPreview ? (
                       <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                     ) : (
                       <Users className="text-gray-400" />
                     )}
                     <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" onChange={handleAvatarUpload} />
                     <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Upload className="text-white w-5 h-5" />
                     </div>
                   </div>
                   <div className="text-xs text-gray-400">
                     <p>点击上传自定义图片</p>
                     <p>支持 JPG, PNG, WEBP</p>
                   </div>
                 </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">专业领域</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newExpertRole}
                  onChange={(e) => setNewExpertRole(e.target.value as ExpertRole)}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">专家姓名 (可选，留空则由 AI 生成)</label>
                <input 
                  type="text"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="例如：张总, Dr. Smith"
                  value={newExpertName}
                  onChange={(e) => setNewExpertName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 mb-1">人设/提示词指南 (可选)</label>
                <textarea 
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 text-gray-900 h-24 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="例如：一位讨厌加密货币的保守派银行家..."
                  value={newExpertPrompt}
                  onChange={(e) => setNewExpertPrompt(e.target.value)}
                />
              </div>

              <button 
                onClick={handleCreateExpert}
                disabled={isGeneratingExpert}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                {isGeneratingExpert ? <Loader2 className="animate-spin" /> : '生成人设'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const UsersIcon = ({count}: {count: number}) => (
  <div className="relative">
    <Users size={24} />
    {count > 0 && (
      <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-sm">
        {count}
      </span>
    )}
  </div>
);
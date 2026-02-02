import React, { useState, useRef } from 'react';
import { AIModelConfig, Expert, AnalysisResult } from '../types';
import { Trash2, Plus, Download, Upload, RefreshCw, HardDrive, PlugZap, CheckCircle2, XCircle, HelpCircle, AlertTriangle, Globe } from 'lucide-react';
import { testModelConnection } from '../services/aiService';

interface AdminPanelProps {
  models: AIModelConfig[];
  setModels: React.Dispatch<React.SetStateAction<AIModelConfig[]>>;
  appState: {
    experts: Expert[];
    team: Expert[];
    projectDescription: string;
    analysisHistory: AnalysisResult[];
  };
  setAppState: {
    setExperts: React.Dispatch<React.SetStateAction<Expert[]>>;
    setTeam: React.Dispatch<React.SetStateAction<Expert[]>>;
    setProjectDescription: React.Dispatch<React.SetStateAction<string>>;
    setAnalysisHistory: React.Dispatch<React.SetStateAction<AnalysisResult[]>>;
  };
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ models, setModels, appState, setAppState }) => {
  const [newModelName, setNewModelName] = useState('');
  const [newModelProvider, setNewModelProvider] = useState('DeepSeek');
  const [newModelId, setNewModelId] = useState('deepseek-chat'); // Default for DeepSeek
  const [newApiKey, setNewApiKey] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('https://api.deepseek.com');
  const [newCorsProxy, setNewCorsProxy] = useState(''); // New State for Proxy
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; msg: string }>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleModel = (id: string) => {
    setModels(models.map(m => m.id === id ? { ...m, isEnabled: !m.isEnabled } : m));
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const provider = e.target.value;
      setNewModelProvider(provider);
      
      // Auto-suggest correct settings
      if (provider === 'DeepSeek') {
          setNewModelId('deepseek-chat');
          setNewBaseUrl('https://api.deepseek.com');
      } else if (provider === 'Moonshot') {
          setNewModelId('moonshot-v1-8k');
          setNewBaseUrl('https://api.moonshot.cn/v1');
      } else if (provider === 'OpenAI') {
          setNewModelId('gpt-4o');
          setNewBaseUrl('https://api.openai.com/v1');
      } else if (provider === 'Aliyun') {
          setNewModelId('qwen-max');
          setNewBaseUrl('https://dashscope.aliyuncs.com/compatible-mode/v1');
      } else if (provider === 'ByteDance') {
          setNewModelId('doubao-pro-32k');
          setNewBaseUrl('https://ark.cn-beijing.volces.com/api/v3');
      } else if (provider === 'Zhipu') {
          setNewModelId('glm-4');
          setNewBaseUrl('https://open.bigmodel.cn/api/paas/v4');
      } else if (provider === 'Google') {
          setNewModelId('gemini-2.0-flash');
          setNewBaseUrl('https://generativelanguage.googleapis.com/v1beta/openai');
      } else {
          setNewModelId('');
          setNewBaseUrl('');
      }
  };

  const addModel = () => {
    if (!newModelName || !newModelId) return;
    const newModel: AIModelConfig = {
      id: `m_${Date.now()}`,
      name: newModelName,
      provider: newModelProvider as any,
      modelId: newModelId, // Use manual ID
      isEnabled: true,
      apiKey: newApiKey,
      baseUrl: newBaseUrl,
      corsProxy: newCorsProxy || undefined
    };
    setModels([...models, newModel]);
    
    // Reset Form
    setNewModelName('');
    setNewApiKey('');
    // Keep provider/modelId/baseUrl for easier continuous entry
  };

  const deleteModel = (id: string) => {
    const model = models.find(m => m.id === id);
    if (model?.isEnabled) {
      const confirmed = window.confirm(`确定要删除已启用的模型 "${model.name}" 吗？此操作无法撤销。`);
      if (!confirmed) return;
    }
    setModels(models.filter(m => m.id !== id));
  };

  const handleTestConnection = async (model: AIModelConfig) => {
      setTestingId(model.id);
      setTestResults(prev => ({ ...prev, [model.id]: { success: false, msg: 'Testing...' } }));
      
      try {
          const result = await testModelConnection(model);
          setModels(prev => prev.map(m => m.id === model.id ? { ...m, isVerified: result.success } : m));
          setTestResults(prev => ({ ...prev, [model.id]: result }));
      } catch (e) {
          setModels(prev => prev.map(m => m.id === model.id ? { ...m, isVerified: false } : m));
          setTestResults(prev => ({ ...prev, [model.id]: { success: false, msg: 'Unknown Error' } }));
      } finally {
          setTestingId(null);
      }
  };

  const handleExportData = () => {
    const exportData = {
      timestamp: Date.now(),
      version: '1.0',
      data: {
        experts: appState.experts,
        team: appState.team,
        projectDescription: appState.projectDescription,
        analysisHistory: appState.analysisHistory,
        models: models
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ExpertMinds_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.data) throw new Error("Invalid format");

        // Restore State
        if (json.data.experts) setAppState.setExperts(json.data.experts);
        if (json.data.team) setAppState.setTeam(json.data.team);
        if (json.data.projectDescription) setAppState.setProjectDescription(json.data.projectDescription);
        if (json.data.analysisHistory) setAppState.setAnalysisHistory(json.data.analysisHistory);
        if (json.data.models) setModels(json.data.models);

        alert('数据导入成功！');
      } catch (error) {
        console.error(error);
        alert('导入失败：文件格式不正确');
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      <div className="flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">模型与数据管理</h2>
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded-lg flex items-start gap-2">
             <AlertTriangle size={16} className="mt-0.5 shrink-0" />
             <div>
                <strong>连接提示 (Failed to fetch):</strong> 
                由于浏览器 CORS 安全策略，Kimi (Moonshot) 等 API 无法直接在浏览器中使用。
                <br/>
                <span className="font-bold">解决方案：</span> 请填写 "CORS Proxy" 字段。推荐使用开源代理 <code>https://cors-anywhere.herokuapp.com/</code> (需申请权限) 或搭建自己的代理。
             </div>
          </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20">
        
        {/* Models List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex-shrink-0">
            <div className="p-4 bg-gray-50 border-b border-gray-200 font-semibold text-gray-600 grid grid-cols-12 gap-4">
            <div className="col-span-3">模型名称 / ID</div>
            <div className="col-span-2">提供商</div>
            <div className="col-span-4">API配置状态</div>
            <div className="col-span-3 text-right">操作</div>
            </div>
            
            <div className="divide-y divide-gray-100">
            {models.map(model => (
                <div key={model.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3">
                    <div className="font-medium text-gray-900">{model.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{model.modelId}</div>
                </div>
                <div className="col-span-2">
                    <span className="bg-white text-gray-600 text-xs px-2 py-1 rounded border border-gray-200 inline-block shadow-sm">
                    {model.provider}
                    </span>
                </div>
                <div className="col-span-4">
                    {model.apiKey ? (
                         <div className="text-xs flex flex-col gap-1">
                             <div className="flex items-center gap-2">
                                <span className="text-green-600 font-medium">已配置 API Key</span>
                             </div>
                             <span className="text-gray-400 truncate max-w-[200px]">{model.baseUrl || 'Default URL'}</span>
                             {model.corsProxy && <span className="text-orange-400 font-mono">Proxy: {model.corsProxy}</span>}
                         </div>
                    ) : (
                         <span className="text-xs text-gray-400 italic">使用默认内置通道</span>
                    )}

                    {/* Test Result Feedback */}
                    {testResults[model.id] && (
                        <div className={`mt-2 text-[10px] px-2 py-1 rounded border ${testResults[model.id].success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                            {testResults[model.id].success ? (
                                <span className="flex items-center gap-1"><CheckCircle2 size={10}/> 连接成功</span>
                            ) : (
                                <span className="flex items-start gap-1 text-wrap break-all"><XCircle size={10} className="shrink-0 mt-0.5"/> {testResults[model.id].msg}</span>
                            )}
                        </div>
                    )}
                </div>
                <div className="col-span-3 flex justify-end gap-2">
                    <button 
                        onClick={() => handleTestConnection(model)}
                        disabled={testingId === model.id}
                        className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-1 ${testingId === model.id ? 'bg-gray-100 text-gray-400' : 'bg-white border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`}
                    >
                        {testingId === model.id ? <RefreshCw className="animate-spin" size={12}/> : <PlugZap size={12}/>}
                        测试
                    </button>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={model.isEnabled} onChange={() => toggleModel(model.id)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <button onClick={() => deleteModel(model.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="删除模型">
                         <Trash2 size={16} />
                    </button>
                </div>
                </div>
            ))}
            </div>
        </div>

        {/* Add New Model */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex-shrink-0 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Plus size={20} className="text-blue-600"/> 接入新模型
            </h3>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">服务提供商</label>
                        <select 
                            className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            value={newModelProvider}
                            onChange={handleProviderChange}
                        >
                            <option value="DeepSeek">DeepSeek (V3/R1)</option>
                            <option value="Moonshot">Moonshot (Kimi)</option>
                            <option value="OpenAI">OpenAI (ChatGPT)</option>
                            <option value="Aliyun">Aliyun (通义千问)</option>
                            <option value="Zhipu">Zhipu AI (智谱GLM)</option>
                            <option value="ByteDance">ByteDance (豆包)</option>
                            <option value="Google">Google (Gemini)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">模型显示名称</label>
                        <input 
                            type="text" 
                            placeholder="例如：My Kimi" 
                            className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            value={newModelName}
                            onChange={(e) => setNewModelName(e.target.value)}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                             <label className="block text-xs font-medium text-gray-500">Model ID (API 参数)</label>
                        </div>
                        <input 
                            list="model-suggestions"
                            type="text" 
                            placeholder="例如：moonshot-v1-8k" 
                            className="w-full bg-blue-50 border border-blue-200 text-blue-800 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            value={newModelId}
                            onChange={(e) => setNewModelId(e.target.value)}
                        />
                        <datalist id="model-suggestions">
                            <option value="deepseek-chat">DeepSeek V3 (Chat)</option>
                            <option value="deepseek-reasoner">DeepSeek R1 (Reasoner)</option>
                            <option value="moonshot-v1-8k">Kimi (8k)</option>
                            <option value="moonshot-v1-32k">Kimi (32k)</option>
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="qwen-max">Qwen Max</option>
                            <option value="glm-4">GLM-4</option>
                        </datalist>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">API Key (sk-...)</label>
                        <input 
                            type="password" 
                            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx" 
                            className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            value={newApiKey}
                            onChange={(e) => setNewApiKey(e.target.value)}
                        />
                    </div>
                     {/* Advanced Settings Toggle */}
                     <div className="flex items-end">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-xs text-blue-600 underline hover:text-blue-800"
                        >
                            {showAdvanced ? "隐藏高级设置" : "显示高级设置 (BaseURL, Proxy)"}
                        </button>
                    </div>
                </div>

                {showAdvanced && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn bg-gray-50 p-3 rounded-lg border border-gray-200">
                         <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">API Endpoint (Base URL)</label>
                            <input 
                                type="text" 
                                placeholder="例如：https://api.moonshot.cn/v1" 
                                className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={newBaseUrl}
                                onChange={(e) => setNewBaseUrl(e.target.value)}
                            />
                        </div>
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Globe size={14} className="text-gray-500" />
                                <label className="block text-xs font-medium text-gray-700">自定义 CORS Proxy (可选)</label>
                            </div>
                            <input 
                                type="text" 
                                placeholder="通常不需要填写 (系统会自动代理)" 
                                className="w-full bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-300"
                                value={newCorsProxy}
                                onChange={(e) => setNewCorsProxy(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center pt-2">
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                        <HelpCircle size={12} />
                        Kimi/DeepSeek 建议配合 Proxy 使用。
                    </div>
                    <button 
                        onClick={addModel}
                        disabled={!newModelName || !newModelId}
                        className={`bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors ${(!newModelName || !newModelId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Plus size={18} /> 添加模型配置
                    </button>
                </div>
            </div>
        </div>

        {/* Data Migration Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 overflow-hidden shadow-sm flex-shrink-0">
            <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <HardDrive className="text-blue-600" /> 数据备份与迁移
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                由于本应用运行在本地浏览器中，如果您更换电脑或清除浏览器缓存，数据将会丢失。
                请定期导出备份，或使用此功能在不同设备间迁移数据。
                </p>

                <div className="flex gap-4">
                <button 
                    onClick={handleExportData}
                    className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-300 px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
                >
                    <Download size={18} /> 导出备份 (JSON)
                </button>
                
                <div className="relative">
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleImportData}
                        className="hidden" 
                        accept=".json"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg font-medium shadow-md transition-all"
                    >
                        <Upload size={18} /> 导入数据
                    </button>
                </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
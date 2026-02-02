import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sidebar } from './components/Sidebar';
import { TeamBuilder } from './components/TeamBuilder';
import { ArenaMode } from './components/ArenaMode';
import { AdminPanel } from './components/AdminPanel';
import { ExpertManager } from './components/ExpertManager';
import { TeamTasks } from './components/TeamTasks';
import { INITIAL_EXPERTS, INITIAL_MODELS } from './constants';
import { Expert, AIModelConfig, AnalysisResult, StructuredAnalysis } from './types';
import { Download, ArrowLeft, TrendingUp, AlertTriangle, CheckCircle, AlertCircle, BarChart3, Clock, FileText, ChevronRight } from 'lucide-react';

declare global {
    interface Window {
        html2pdf: any;
    }
}

// Hook for persistent local storage
function useStickyState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error writing localStorage key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue];
}

const App = () => {
  const [activeTab, setActiveTab] = useState('team-builder');
  
  // App State with Persistence
  const [experts, setExperts] = useStickyState<Expert[]>(INITIAL_EXPERTS, 'em_experts');
  const [team, setTeam] = useStickyState<Expert[]>([], 'em_team');
  const [models, setModels] = useStickyState<AIModelConfig[]>(INITIAL_MODELS, 'em_models');
  const [projectDescription, setProjectDescription] = useStickyState('', 'em_project');
  const [analysisHistory, setAnalysisHistory] = useStickyState<AnalysisResult[]>([], 'em_history');
  
  // Results State (Transient, no need to persist currently displayed result separately)
  const [currentAnalysisResults, setCurrentAnalysisResults] = useState<AnalysisResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setCurrentAnalysisResults([result]);
    setAnalysisHistory(prev => [result, ...prev]);
    setShowResults(true);
  };

  const handleRaceComplete = (results: AnalysisResult[]) => {
    setCurrentAnalysisResults(results);
    setAnalysisHistory(prev => [...results, ...prev]);
    setShowResults(true);
  };

  // Synchronize updates across the expert library AND the selected team
  const handleExpertUpdate = (updatedExpert: Expert) => {
    setExperts(prev => prev.map(e => e.id === updatedExpert.id ? updatedExpert : e));
    setTeam(prev => prev.map(e => e.id === updatedExpert.id ? updatedExpert : e));
  };

  const downloadMarkdown = (result: AnalysisResult) => {
    const blob = new Blob([result.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ExpertMinds_Analysis_${result.modelName}_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
      const element = document.getElementById('report-content');
      if (!element || !window.html2pdf) return;
      
      const opt = {
          margin: 10,
          filename: `ExpertMinds_Report_${Date.now()}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      const originalStyle = element.style.cssText;
      element.style.height = 'auto';
      element.style.overflow = 'visible';

      window.html2pdf().set(opt).from(element).save().then(() => {
          element.style.cssText = originalStyle;
      });
  };

  const getRiskColor = (level: string) => {
    switch(level) {
      case 'Low': return 'text-green-600 border-green-200 bg-green-50';
      case 'Medium': return 'text-yellow-600 border-yellow-200 bg-yellow-50';
      case 'High': return 'text-orange-600 border-orange-200 bg-orange-50';
      case 'Critical': return 'text-red-600 border-red-200 bg-red-50';
      default: return 'text-gray-500 border-gray-200 bg-gray-50';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
     if (sentiment === 'positive') return <CheckCircle size={16} className="text-green-500" />;
     if (sentiment === 'negative') return <AlertTriangle size={16} className="text-red-500" />;
     return <AlertCircle size={16} className="text-yellow-500" />;
  };

  // Component to display the visual dashboard for a single result
  const ResultDashboard = ({ data }: { data: StructuredAnalysis }) => {
    return (
       <div className="mb-8 space-y-6">
          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-full text-blue-500">
                   <TrendingUp size={24} />
                </div>
                <div>
                   <p className="text-sm text-gray-500">项目可行性评分</p>
                   <div className="flex items-baseline gap-2">
                     <span className="text-3xl font-bold text-gray-900">{data.overallScore}</span>
                     <span className="text-sm text-gray-400">/ 100</span>
                   </div>
                </div>
             </div>

             <div className={`p-4 rounded-xl border flex items-center gap-4 shadow-sm ${getRiskColor(data.riskLevel)}`}>
                <div className="p-3 rounded-full bg-white/50">
                   <AlertTriangle size={24} />
                </div>
                <div>
                   <p className="text-sm opacity-80">综合风险评级</p>
                   <span className="text-2xl font-bold">{data.riskLevel}</span>
                </div>
             </div>

             <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
                <p className="text-sm text-gray-400 mb-1">AI 委员会综述</p>
                <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed font-medium">"{data.summary}"</p>
             </div>
          </div>

          {/* Expert Cards Grid */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-gray-600">
               <BarChart3 size={18} />
               <h3 className="font-semibold">专家核心观点 & 投票</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.expertInsights.map((insight, idx) => (
                 <div key={idx} className="bg-white border border-gray-200 p-4 rounded-lg flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                       <div>
                          <p className="font-bold text-gray-800">{insight.expertName}</p>
                          <p className="text-xs text-gray-500 bg-gray-100 inline-block px-2 py-0.5 rounded mt-1">{insight.role}</p>
                       </div>
                       <div className="flex flex-col items-end">
                          <span className={`text-lg font-bold ${insight.score > 70 ? 'text-green-500' : insight.score < 40 ? 'text-red-500' : 'text-yellow-500'}`}>
                            {insight.score}
                          </span>
                          <span className="text-[10px] text-gray-400">认可度</span>
                       </div>
                    </div>
                    
                    {/* Score Bar */}
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                       <div 
                         className={`h-full rounded-full ${insight.score > 70 ? 'bg-green-500' : insight.score < 40 ? 'bg-red-500' : 'bg-yellow-500'}`} 
                         style={{ width: `${insight.score}%` }}
                       ></div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-md border border-gray-100 mt-1">
                       <div className="flex gap-2 items-start">
                          <div className="mt-0.5 shrink-0">{getSentimentIcon(insight.sentiment)}</div>
                          <p className="text-sm text-gray-600 leading-snug">
                             {insight.keyPoint}
                          </p>
                       </div>
                    </div>
                 </div>
              ))}
            </div>
          </div>
       </div>
    );
  };

  const renderContent = () => {
    if (showResults) {
      return (
        <div className="h-full flex flex-col animate-fadeIn">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <button 
              onClick={() => setShowResults(false)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm"
            >
              <ArrowLeft size={20} /> 返回
            </button>
            <div className="flex gap-2">
                <h2 className="text-xl font-bold text-gray-900">
                {currentAnalysisResults.length > 1 ? "赛马结果对比" : "委员会分析报告"}
                </h2>
                <button
                    onClick={downloadPDF}
                    className="ml-4 flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-red-100"
                >
                    <FileText size={16} /> 导出 PDF
                </button>
            </div>
          </div>

          <div 
            id="report-content"
            className={`flex-1 overflow-x-auto overflow-y-auto ${currentAnalysisResults.length > 1 ? 'flex gap-6' : ''} pb-10`}
          >
            {currentAnalysisResults.map((res, index) => (
              <div key={res.id} className={`bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col ${currentAnalysisResults.length > 1 ? 'min-w-[500px] w-1/2' : 'w-full'} mb-8`}>
                 <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center rounded-t-xl">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{res.modelName}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                         <span>{new Date(res.timestamp).toLocaleDateString()}</span>
                         <span>•</span>
                         <span>{res.teamComposition.length} 位专家参会</span>
                      </p>
                    </div>
                    <button 
                      onClick={() => downloadMarkdown(res)}
                      className="p-2 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700" title="导出 Markdown 源码"
                    >
                      <Download size={18} />
                    </button>
                 </div>
                 
                 <div className="p-8">
                   {/* 1. VISUAL DASHBOARD */}
                   {res.structuredData && <ResultDashboard data={res.structuredData} />}

                   {/* 2. MARKDOWN REPORT HEADER */}
                   {res.structuredData && (
                     <div className="flex items-center gap-2 mb-4 pt-6 border-t border-gray-100">
                        <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                        <h3 className="font-bold text-gray-900 text-lg">详细会议纪要</h3>
                     </div>
                   )}

                   {/* 3. MARKDOWN CONTENT */}
                   <div className="markdown-body bg-gray-50 p-6 rounded-lg border border-gray-100">
                     <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {res.content}
                     </ReactMarkdown>
                   </div>
                 </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'history') {
        return (
            <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Clock className="text-blue-500" /> 项目历史记录
                </h2>
                
                {analysisHistory.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-gray-400 mb-2">暂无历史记录</p>
                        <p className="text-sm text-gray-300">完成一次分析后，结果将自动保存于此</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {analysisHistory.map((item) => (
                            <div 
                                key={item.id} 
                                onClick={() => { setCurrentAnalysisResults([item]); setShowResults(true); }}
                                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-50 p-3 rounded-full text-blue-600 group-hover:bg-blue-100 transition-colors">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-gray-800 group-hover:text-blue-700">{item.modelName} 分析报告</h3>
                                            {item.structuredData && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getRiskColor(item.structuredData.riskLevel)}`}>
                                                    {item.structuredData.riskLevel} Risk
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(item.timestamp).toLocaleString()} • {item.teamComposition.length} 位专家
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="text-gray-300 group-hover:text-blue-500" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    switch (activeTab) {
      case 'team-builder':
        return (
          <TeamBuilder 
            availableExperts={experts}
            setAvailableExperts={setExperts}
            team={team}
            setTeam={setTeam}
            models={models}
            projectDescription={projectDescription}
            setProjectDescription={setProjectDescription}
            onAnalysisComplete={handleAnalysisComplete}
          />
        );
      case 'team-tasks':
        return (
          <TeamTasks 
            team={team}
            projectDescription={projectDescription}
          />
        );
      case 'expert-manager':
        return (
          <ExpertManager 
             experts={experts}
             onUpdateExpert={handleExpertUpdate}
          />
        );
      case 'arena':
        return (
          <ArenaMode 
            team={team}
            models={models}
            projectDescription={projectDescription}
            onRaceComplete={handleRaceComplete}
          />
        );
      case 'admin':
        return (
          <AdminPanel 
            models={models} 
            setModels={setModels} 
            appState={{ experts, team, projectDescription, analysisHistory }}
            setAppState={{
              setExperts,
              setTeam,
              setProjectDescription,
              setAnalysisHistory
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={(tab) => {
        setActiveTab(tab);
        setShowResults(false);
      }} />
      <main className="flex-1 ml-20 lg:ml-64 p-6 overflow-hidden h-screen">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
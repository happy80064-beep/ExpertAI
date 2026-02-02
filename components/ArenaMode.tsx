import React, { useState } from 'react';
import { Expert, AIModelConfig, AnalysisResult } from '../types';
import { runTeamAnalysis } from '../services/aiService';
import { Play, Loader2, CheckSquare, Square } from 'lucide-react';

interface ArenaModeProps {
  team: Expert[];
  models: AIModelConfig[];
  projectDescription: string;
  onRaceComplete: (results: AnalysisResult[]) => void;
}

export const ArenaMode: React.FC<ArenaModeProps> = ({ team, models, projectDescription, onRaceComplete }) => {
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set([models[0]?.id]));
  const [isRacing, setIsRacing] = useState(false);

  const toggleModel = (id: string) => {
    const newSet = new Set(selectedModelIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedModelIds(newSet);
  };

  const startRace = async () => {
    if (team.length === 0) return alert("请先去专家团组建页面选择专家。");
    if (selectedModelIds.size < 2) return alert("请至少选择 2 个模型进行比赛。");
    if (!projectDescription) return alert("请在专家团组建页面输入项目详情。");

    setIsRacing(true);
    const promises: Promise<AnalysisResult>[] = [];

    selectedModelIds.forEach(id => {
      const model = models.find(m => m.id === id);
      if (model) {
        // Pass the full model config to support real external API calls
        promises.push(runTeamAnalysis(projectDescription, team, model));
      }
    });

    try {
      const results = await Promise.all(promises);
      onRaceComplete(results);
    } catch (e) {
      console.error(e);
      alert("赛马模式运行出错，请检查部分模型的 API 配置是否正确。");
    } finally {
      setIsRacing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-100 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">赛马模式 (竞技场)</h2>
        <p className="text-gray-600">
          让同一个专家团队使用不同的 AI 大脑同时对您的项目进行分析。
          横向对比不同模型的逻辑、语气和结论质量。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Model Selection */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">选择参赛选手</h3>
          <div className="space-y-3">
            {models.filter(m => m.isEnabled).map(model => (
              <div 
                key={model.id}
                onClick={() => toggleModel(model.id)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
                  selectedModelIds.has(model.id) 
                    ? 'bg-purple-50 border-purple-300 shadow-sm' 
                    : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                   <div className={`w-2 h-2 rounded-full ${model.provider === 'Google' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                   <span className="font-medium text-gray-800">{model.name}</span>
                   <span className="text-xs text-gray-400 uppercase">{model.provider}</span>
                </div>
                {selectedModelIds.has(model.id) ? <CheckSquare className="text-purple-600" size={20} /> : <Square className="text-gray-400" size={20} />}
              </div>
            ))}
          </div>
        </div>

        {/* Current Config Summary */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">比赛配置</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span>出场专家:</span>
                <span className="font-mono text-gray-900">{team.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span>已选模型:</span>
                <span className="font-mono text-gray-900">{selectedModelIds.size}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span>项目字数:</span>
                <span className="font-mono text-gray-900">{projectDescription.length} 字符</span>
              </div>
            </div>
          </div>

          <button 
            onClick={startRace}
            disabled={isRacing || selectedModelIds.size < 2}
            className={`w-full py-4 mt-6 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md ${
              isRacing || selectedModelIds.size < 2
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
            }`}
          >
            {isRacing ? (
              <>
                <Loader2 className="animate-spin" /> 比赛进行中...
              </>
            ) : (
              <>
                <Play fill="currentColor" /> 开始比赛
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
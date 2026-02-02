import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Expert, TaskResult, AIModelConfig } from '../types';
import { runExpertTask } from '../services/aiService';
import { Send, CheckCircle, Clock, Trash2, Bot, AlertCircle, Download, Check, XCircle, Users, CornerDownRight, Sparkles, StopCircle, Info, Cpu, AlertTriangle } from 'lucide-react';
import { INITIAL_MODELS } from '../constants'; // Fallback import

interface TeamTasksProps {
  team: Expert[];
  projectDescription: string;
}

// Local interface for handling pending tasks visually
interface PendingTask {
  id: string;
  expertId: string;
  expertName: string;
  expertAvatar: string;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string; // New field for detailed error
  triggerBy?: string; // If triggered by another expert
}

export const TeamTasks: React.FC<TeamTasksProps> = ({ team, projectDescription }) => {
  // Read models from localStorage directly to get user's custom models
  const [availableModels, setAvailableModels] = useState<AIModelConfig[]>(() => {
      try {
          const stored = window.localStorage.getItem('em_models');
          return stored ? JSON.parse(stored) : INITIAL_MODELS;
      } catch (e) {
          return INITIAL_MODELS;
      }
  });

  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
      // Default to first enabled model
      const firstEnabled = availableModels.find(m => m.isEnabled);
      return firstEnabled ? firstEnabled.id : '';
  });

  // State for Multi-select
  const [selectedExpertIds, setSelectedExpertIds] = useState<Set<string>>(new Set(team.length > 0 ? [team[0].id] : []));
  
  const [taskInput, setTaskInput] = useState('');
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  
  // Execution Control State
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [terminationMessage, setTerminationMessage] = useState<string | null>(null);

  // Mention Logic State
  const [showMentionList, setShowMentionList] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Control Flag for stopping recursion
  const stopAutoExecutionRef = useRef(false);

  // Update selected IDs when team changes
  useEffect(() => {
    const currentTeamIds = new Set(team.map(e => e.id));
    setSelectedExpertIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        if (currentTeamIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [team]);

  const toggleExpertSelection = (id: string) => {
    const newSet = new Set(selectedExpertIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedExpertIds(newSet);
  };

  const selectAllExperts = () => {
    if (selectedExpertIds.size === team.length) {
      setSelectedExpertIds(new Set());
    } else {
      setSelectedExpertIds(new Set(team.map(e => e.id)));
    }
  };

  const handleInputStringChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTaskInput(val);
    if (val.endsWith('@')) {
      setShowMentionList(true);
    } else if (showMentionList && !val.includes('@')) {
        setShowMentionList(false);
    }
  };

  const handleMentionSelect = (expert: Expert) => {
    setTaskInput(prev => prev + expert.name + ' ');
    setSelectedExpertIds(prev => new Set(prev).add(expert.id));
    setShowMentionList(false);
    textareaRef.current?.focus();
  };

  const handleStopExecution = () => {
      stopAutoExecutionRef.current = true;
      setTerminationMessage("⚠️ 用户已手动终止互动！当前正在进行的任务回复完成后，将不再触发新的自动指令。");
      // Optional: Update UI to reflect cancellation of pending tasks if desired
      // We keep the activeTaskCount logic as is, it will naturally drain to 0 as ongoing requests finish or are skipped.
  };

  /**
   * Recursive function to execute a single task and check for auto-delegation triggers
   * @param depth - Prevents infinite loops. Default max depth is 2.
   */
  const executeSingleTask = async (expert: Expert, instruction: string, triggerBy?: string, depth: number = 0) => {
     // Check if stopped
     if (stopAutoExecutionRef.current) {
         // This task was queued but execution stopped before it started
         setActiveTaskCount(prev => Math.max(0, prev - 1));
         return;
     }

     const MAX_DEPTH = 2; // Boundary: Max 2 levels of autonomous delegation

     try {
         // 1. Add visual pending state
         const pendingId = `pending_${Date.now()}_${expert.id}`;
         setPendingTasks(prev => [...prev, {
            id: pendingId,
            expertId: expert.id,
            expertName: expert.name,
            expertAvatar: expert.avatar,
            status: 'pending',
            triggerBy: triggerBy
         }]);

         // 2. Call AI Service - Now passing Model Config
         const targetModel = availableModels.find(m => m.id === selectedModelId);
         const result = await runExpertTask(expert, instruction, projectDescription, team, depth, targetModel);
         
         // 3. Attach trigger info
         if (triggerBy) {
            result.triggerBy = triggerBy;
         }

         // 4. Parse for Delegation Protocol: :::DELEGATE:::TargetName:::Instruction:::
         // If we are already at MAX_DEPTH, we ignore the output codes to enforce hard stop at client side too
         const delegateRegex = /:::DELEGATE:::(.+?):::(.+?):::/g;
         let match;
         const followUpTasks: {target: Expert, instruction: string}[] = [];

         if (depth < MAX_DEPTH) {
            while ((match = delegateRegex.exec(result.resultContent)) !== null) {
                const [fullMatch, targetNamePartial, nextInstruction] = match;
                // Find the expert in the current team (fuzzy match)
                const targetExpert = team.find(e => e.name.toLowerCase().includes(targetNamePartial.trim().toLowerCase()));
                
                if (targetExpert && targetExpert.id !== expert.id) {
                   followUpTasks.push({ target: targetExpert, instruction: nextInstruction });
                }
            }
         }

         // Clean the hidden codes from the display content
         result.resultContent = result.resultContent.replace(delegateRegex, '');

         // 5. Update State with Result
         setTaskResults(prev => [result, ...prev]);
         setPendingTasks(prev => prev.filter(p => p.expertId !== expert.id)); // Remove from pending

         // 6. Automatically trigger follow-up tasks if depth allows and not stopped
         const willContinue = followUpTasks.length > 0 && depth < MAX_DEPTH && !stopAutoExecutionRef.current;
         
         if (willContinue) {
            // IMPORTANT: Increment active count BEFORE setTimeout to prevent button flickering
            setActiveTaskCount(prev => prev + followUpTasks.length);

            // Using a small delay to make it feel natural and prevent UI jank
            setTimeout(() => {
               followUpTasks.forEach(task => {
                  executeSingleTask(task.target, task.instruction, expert.name, depth + 1);
               });
            }, 1000);
         }

     } catch (error: any) {
         console.error("Execute Task Error:", error);
         const errMessage = error?.message || "未知错误";
         setPendingTasks(prev => prev.map(p => p.expertId === expert.id ? { ...p, status: 'error', errorMessage: errMessage } : p));
     } finally {
         // Always decrement active count when a task finishes (whether success or error)
         setActiveTaskCount(prev => Math.max(0, prev - 1));
     }
  };

  const handleExecuteBatchTasks = async () => {
    if (selectedExpertIds.size === 0) return alert('请至少选择一位专家');
    if (!taskInput.trim()) return alert('请输入任务内容');
    if (!projectDescription.trim()) return alert('请先在“专家团组建”页面完善项目背景');

    const selectedExperts = team.filter(e => selectedExpertIds.has(e.id));
    
    // Reset control flags
    stopAutoExecutionRef.current = false;
    setTerminationMessage(null);

    // Clear input
    setTaskInput('');
    setShowMentionList(false);

    // Set initial active count
    setActiveTaskCount(selectedExperts.length);

    // Launch all initial tasks in parallel
    selectedExperts.forEach(expert => {
       executeSingleTask(expert, taskInput, undefined, 0);
    });
  };

  const handleDeleteResult = (id: string) => {
      setTaskResults(taskResults.filter(r => r.id !== id));
  };
  
  const handleClearPending = (expertId: string) => {
     setPendingTasks(prev => prev.filter(p => p.expertId !== expertId));
  };

  const handleDownloadResult = (result: TaskResult) => {
    const filename = `${result.expertName}_Task_${new Date(result.timestamp).toISOString().slice(0,10)}.md`;
    const content = `# 任务执行报告\n\n**执行专家**: ${result.expertName}\n**时间**: ${new Date(result.timestamp).toLocaleString()}\n\n## 任务指令\n${result.taskDescription}\n\n## 执行结果\n\n${result.resultContent}`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (team.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="bg-gray-100 p-6 rounded-full mb-4">
          <AlertCircle size={48} className="text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">暂无团队成员</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          请先前往“专家团组建”页面选择您的顾问团队，然后在此处为他们分配特定任务。
        </p>
      </div>
    );
  }

  // Determine if processing based on the accurate counter
  const isProcessing = activeTaskCount > 0;

  return (
    <div className="h-full flex flex-col gap-6 max-w-6xl mx-auto relative">
      <div>
         <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <CheckCircle className="text-blue-600" /> 团队任务分配
         </h2>
         <p className="text-gray-600">
            通过 @ 提及或点击选择多位专家，基于项目背景执行专项任务。AI 专家互动深度限制为 2 层。
         </p>
      </div>

      {/* Termination Alert */}
      {terminationMessage && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl flex items-center gap-3 animate-fadeIn shadow-sm">
            <StopCircle size={20} className="text-orange-500" />
            <span className="font-medium text-sm">{terminationMessage}</span>
            <button onClick={() => setTerminationMessage(null)} className="ml-auto text-orange-400 hover:text-orange-600">
                <XCircle size={18} />
            </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 min-h-0 flex-1">
         {/* Left: Input Area */}
         <div className="lg:w-2/5 flex flex-col gap-4">
            
            {/* Expert Multi-Selector */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
               <div className="flex justify-between items-center mb-3">
                 <h3 className="font-semibold text-gray-700">1. 选择执行人 ({selectedExpertIds.size})</h3>
                 <button 
                   onClick={selectAllExperts}
                   className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded bg-blue-50"
                 >
                   {selectedExpertIds.size === team.length ? '取消全选' : '全选'}
                 </button>
               </div>
               
               <div className="grid grid-cols-4 gap-2">
                  {team.map(expert => {
                     const isSelected = selectedExpertIds.has(expert.id);
                     return (
                       <button
                          key={expert.id}
                          onClick={() => toggleExpertSelection(expert.id)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border relative ${
                             isSelected
                             ? 'bg-blue-50 border-blue-400 shadow-sm' 
                             : 'bg-white border-gray-100 hover:bg-gray-50'
                          }`}
                       >
                          <div className={`relative rounded-full p-0.5 ${isSelected ? 'bg-blue-500' : 'bg-transparent'}`}>
                             <img src={expert.avatar} alt={expert.name} className="w-10 h-10 rounded-full object-cover" />
                             {isSelected && (
                               <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full text-white border-2 border-white">
                                 <Check size={10} strokeWidth={4} />
                               </div>
                             )}
                          </div>
                          <p className={`mt-1 text-[10px] font-bold text-center truncate w-full ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>
                             {expert.name.split(' ')[0]}
                          </p>
                       </button>
                     );
                  })}
               </div>
            </div>

            {/* Task Input */}
            <div className="flex-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col relative z-10">
               <div className="flex justify-between items-center mb-3">
                   <h3 className="font-semibold text-gray-700">2. 发布任务指令</h3>
                   <div className="flex items-center gap-2">
                       <Cpu size={14} className="text-gray-400" />
                       <select 
                            className="bg-gray-50 border border-gray-200 rounded text-xs px-2 py-1 outline-none text-gray-600 max-w-[120px]"
                            value={selectedModelId}
                            onChange={(e) => setSelectedModelId(e.target.value)}
                       >
                           {availableModels.filter(m => m.isEnabled).map(m => (
                               <option key={m.id} value={m.id}>{m.name}</option>
                           ))}
                       </select>
                   </div>
               </div>
               
               <div className="relative flex-1">
                 {showMentionList && (
                   <div className="absolute bottom-full left-0 mb-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto animate-fadeIn">
                      <div className="p-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">选择要提及的专家</div>
                      {team.map(expert => (
                        <button
                          key={expert.id}
                          onClick={() => handleMentionSelect(expert)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 transition-colors text-left"
                        >
                           <img src={expert.avatar} className="w-6 h-6 rounded-full" />
                           <span className="text-sm font-medium text-gray-700">{expert.name}</span>
                           <span className="text-xs text-gray-400 ml-auto">{expert.role}</span>
                        </button>
                      ))}
                   </div>
                 )}
                 
                 <textarea 
                    ref={textareaRef}
                    className="w-full h-full min-h-[120px] bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="输入任务描述... 输入 '@' 可快速指定专家。"
                    value={taskInput}
                    onChange={handleInputStringChange}
                 />
               </div>

               <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    已选: {selectedExpertIds.size} 人
                  </span>
                  <div className="flex gap-2">
                      {isProcessing && (
                          <button
                            onClick={handleStopExecution}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors animate-pulse"
                            title="停止所有正在进行的和排队的自动化任务"
                          >
                             <StopCircle size={16} /> 终止互动
                          </button>
                      )}
                      <button 
                         onClick={handleExecuteBatchTasks}
                         disabled={isProcessing || !taskInput.trim() || selectedExpertIds.size === 0}
                         className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white shadow-md transition-all ${
                            isProcessing || !taskInput.trim() || selectedExpertIds.size === 0
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                         }`}
                      >
                         {isProcessing ? (
                            <>正在思考 ({activeTaskCount})...</>
                         ) : (
                            <>
                               <Send size={16} /> 执行任务
                            </>
                         )}
                      </button>
                  </div>
               </div>
            </div>
         </div>

         {/* Right: Results List */}
         <div className="lg:w-3/5 flex flex-col min-h-0 bg-gray-50 rounded-xl border border-gray-200/50">
            <div className="p-4 border-b border-gray-200 bg-white/50 rounded-t-xl flex justify-between items-center">
               <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Clock size={18} /> 任务执行记录 ({taskResults.length})
               </h3>
               {taskResults.length > 0 && (
                 <button onClick={() => setTaskResults([])} className="text-xs text-gray-400 hover:text-red-500">
                   清空记录
                 </button>
               )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {/* Pending Tasks Area */}
               {pendingTasks.map(task => (
                 <div key={task.id} className={`bg-white rounded-xl border shadow-sm p-4 animate-fadeIn flex items-center gap-4 ${task.status === 'error' ? 'border-red-200 bg-red-50' : 'border-blue-100'}`}>
                    <div className="relative">
                       <img src={task.expertAvatar} className="w-10 h-10 rounded-full grayscale opacity-70" />
                       <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                          {task.status === 'error' ? (
                            <XCircle size={14} className="text-red-500" />
                          ) : (
                            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          )}
                       </div>
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2">
                           <p className="font-bold text-gray-800">{task.expertName}</p>
                           {task.triggerBy && (
                                <span className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                                    <Sparkles size={10} /> 被 {task.triggerBy} 点名
                                </span>
                           )}
                       </div>
                       {task.status === 'error' ? (
                           <div className="mt-1 flex items-start gap-1.5 text-red-600">
                                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                <p className="text-xs font-medium break-all">{task.errorMessage || "请求失败，请检查模型配置。"}</p>
                           </div>
                       ) : (
                           <p className="text-xs text-gray-400">正在思考中...</p>
                       )}
                    </div>
                    {task.status === 'error' && (
                        <button onClick={() => handleClearPending(task.expertId)} className="text-gray-400 hover:text-red-500 p-2">
                            <Trash2 size={16} />
                        </button>
                    )}
                 </div>
               ))}

               {taskResults.length === 0 && pendingTasks.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                     <Bot size={48} className="mb-2 opacity-20" />
                     <p>暂无任务记录</p>
                  </div>
               )}

               {taskResults.map(result => (
                  <div key={result.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-fadeIn group relative overflow-hidden">
                     {/* Triggered By Badge */}
                     {result.triggerBy && (
                        <div className="bg-purple-50 border-b border-purple-100 px-5 py-2 -mx-5 -mt-5 mb-4 flex items-center gap-2">
                             <CornerDownRight size={14} className="text-purple-500" />
                             <span className="text-xs text-purple-700 font-medium">自动回复：响应了 {result.triggerBy} 的请求</span>
                        </div>
                     )}

                     <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-50">
                        <div className="flex items-center gap-3">
                           <div className="relative">
                             <img src={result.expertAvatar} className="w-10 h-10 rounded-full border border-gray-200" />
                             <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border border-white">
                               <Check size={10} strokeWidth={3} />
                             </div>
                           </div>
                           <div>
                              <p className="font-bold text-gray-900">{result.expertName}</p>
                              <p className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</p>
                           </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={() => handleDownloadResult(result)} 
                             className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                             title="下载结果"
                           >
                              <Download size={16} />
                           </button>
                           <button 
                             onClick={() => handleDeleteResult(result.id)} 
                             className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                             title="删除"
                           >
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </div>
                     
                     <div className="bg-blue-50/50 p-3 rounded-lg text-sm text-gray-700 mb-4 border border-blue-100">
                        <div className="flex items-start gap-2">
                           <span className="font-semibold text-blue-800 shrink-0">任务:</span>
                           <span className="italic text-gray-600">{result.taskDescription}</span>
                        </div>
                     </div>

                     <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {result.resultContent}
                        </ReactMarkdown>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};
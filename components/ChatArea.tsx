import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { AlertTriangle, ShieldAlert, User, Radio } from 'lucide-react';

interface ChatAreaProps {
  messages: ChatMessage[];
  isProcessing: boolean;
}

const ChatArea: React.FC<ChatAreaProps> = ({ messages, isProcessing }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-800">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-md ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none'
                : msg.role === 'system' 
                  ? 'bg-slate-800 border border-slate-700 text-slate-300 w-full max-w-full'
                  : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1 text-xs opacity-75 uppercase tracking-wider font-bold">
               {msg.role === 'user' && <><User size={12} /> You</>}
               {msg.role === 'assistant' && <><Radio size={12} /> Scene / Patient</>}
               {msg.role === 'system' && <><ShieldAlert size={12} /> System Notice</>}
            </div>
            
            <div className="whitespace-pre-wrap leading-relaxed">
              {msg.content}
            </div>

            {/* Visual indicator for system messages or alerts */}
            {msg.role === 'system' && (
               <div className="mt-2 text-xs text-amber-500 flex items-center gap-1">
                 <AlertTriangle size={12} /> 
                 <span>Check protocols.</span>
               </div>
            )}
          </div>
        </div>
      ))}
      
      {isProcessing && (
        <div className="flex justify-start">
          <div className="bg-slate-800 rounded-2xl rounded-bl-none p-4 border border-slate-700 flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
      
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatArea;

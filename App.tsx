
import React, { useState, useRef, useEffect } from 'react';
import { Ambulance, Stethoscope, Skull, AlertCircle, AlertTriangle, Send, RotateCcw, Lightbulb, Info, Radio, CheckCircle2, Truck, Mic, MicOff, Volume2, VolumeX, Volume1, Activity, MessageSquare, BriefcaseMedical, NotebookPen, PenLine } from 'lucide-react';
import { ScenarioType, GameState, ScenarioData, ChatMessage, Vitals, DebriefReport } from './types';
import { generateScenario, processTurn, generateDebrief, getHint, transcribeHandwriting } from './services/geminiService';
import VitalMonitor from './components/VitalMonitor';
import ChatArea from './components/ChatArea';
import QuickActions from './components/QuickActions';
import EquipmentToolbar from './components/EquipmentToolbar';
import EquipmentModal from './components/EquipmentModal';
import DebriefModal from './components/DebriefModal';
import HintModal from './components/HintModal';
import ReportChecklist from './components/ReportChecklist';
import Timer from './components/Timer';
import HandwritingPad from './components/HandwritingPad';
import AmbulanceGraphic from './components/AmbulanceGraphic';
import StarOfLife from './components/StarOfLife';

const INITIAL_VITALS: Vitals = {};

const BAG_CONTENTS: Record<string, string[]> = {
  'jump': [
    'BP Cuff', 'Stethoscope', 'Glucometer', 'Penlight', 
    'Trauma Shears', 'Oral Glucose', 'Aspirin', 'EpiPen', 
    'Narcan', 'Tourniquet', '4x4 Gauze', 'Abd. Pad',
    'Occlusive Dressing', 'SAM Splint', 'Gauze', 'Albuterol',
    'Hemostatic Bandage', 'Trauma Pad', 'Antiseptic Wipe',
    'Cold Pack', 'Heat Pack', '4x9 Dressing', '8x10 Dressing',
    'Sterile Eye Pads', 'Cloth Tape', 'Cravat', 'Thermal Blanket'
  ],
  'airway': [
    'O2 Cylinder', 'O2 Regulator', 'Nasal Cannula', 'NRB Mask', 
    'BVM (Adult)', 'OPA Kit', 'NPA Kit', 'Suction Unit', 'Pulse Oximeter',
    'BVM (Pediatric)', 'IGel', 'King Tube', 'Nasal Cannula (Ped)',
    'NRB Mask (Ped)', 'Nebulizer (Adult)', 'Nebulizer (Ped)',
    'CPAP', 'CO2 Sampling Cannula'
  ],
  'splint': [
    'C-Collar', 'SAM Splint', 'Triangle Bandage', 'Cold Pack', 
    'Hot Pack', 'Traction Splint', 'Board Splint', 'Occlusive Dressing', 'Burn Sheet'
  ]
};

const BAG_TITLES: Record<string, string> = {
  'jump': 'Primary Jump Bag',
  'airway': 'Airway & O2 Kit',
  'splint': 'Splint & Trauma Bag'
};

const getUserFriendlyErrorMessage = (error: any): string => {
  let message = error instanceof Error ? error.message : String(error);
  try {
    if (message.includes('{') && message.includes('}')) {
      const jsonStart = message.indexOf('{');
      const jsonEnd = message.lastIndexOf('}') + 1;
      const jsonStr = message.substring(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonStr);
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    }
  } catch (e) { }

  if (message.includes('429') || message.includes('quota') || message.includes('exhausted')) {
    return "System is currently busy (Rate Limit Reached). Please wait a few moments and try again.";
  }
  if (message.includes('503') || message.includes('overloaded')) {
    return "AI Service is temporarily overloaded. Please try again in a moment.";
  }
  if (message.includes('Proxying failed') || message.includes('NetworkError') || message.includes('fetch failed')) {
    return "Connection instability detected (Proxy/Network Error). Retrying usually fixes this.";
  }
  return message;
};

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentVitals, setCurrentVitals] = useState<Vitals>(INITIAL_VITALS);
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [phase, setPhase] = useState<string>("Dispatch");
  const [feedbackLog, setFeedbackLog] = useState<string[]>([]);
  const [debriefReport, setDebriefReport] = useState<DebriefReport | null>(null);
  const [isDebriefLoading, setIsDebriefLoading] = useState(false);
  const [isHintModalOpen, setIsHintModalOpen] = useState(false);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isReportChecklistOpen, setIsReportChecklistOpen] = useState(false);
  const [activeBag, setActiveBag] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTimedMode, setIsTimedMode] = useState(false);
  const [showTimerInfo, setShowTimerInfo] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isListeningToNotes, setIsListeningToNotes] = useState(false);
  const notesRecognitionRef = useRef<any>(null);
  const [notes, setNotes] = useState("");
  const [showHandwriting, setShowHandwriting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'vitals' | 'equipment' | 'notebook'>('chat');

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    const hasSeen = sessionStorage.getItem('nremt_disclaimer_seen');
    if (!hasSeen) setShowDisclaimer(true);
  }, []);

  const dismissDisclaimer = () => {
    sessionStorage.setItem('nremt_disclaimer_seen', 'true');
    setShowDisclaimer(false);
  };

  const speak = (text: string, role: 'system' | 'assistant', contextScenario?: ScenarioData | null) => {
    if (isMuted || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;
    const activeScenario = contextScenario || scenario;
    const usVoices = voices.filter(v => v.lang === 'en-US');
    const fallbackVoices = voices.filter(v => v.lang.startsWith('en'));

    if (role === 'system') {
      const dispatchVoice = usVoices.find(v => v.name === "Google US English") || 
                            usVoices.find(v => v.name.includes("Samantha")) || 
                            usVoices[0] || fallbackVoices[0];
      if (dispatchVoice) utterance.voice = dispatchVoice;
      utterance.rate = 1.1;
      utterance.pitch = 1.05;
    } else if (role === 'assistant' && activeScenario) {
      const isFemale = activeScenario.patientGender.toLowerCase().includes('female') || 
                       activeScenario.patientGender.toLowerCase() === 'f';
      let patientVoice;
      if (isFemale) {
        patientVoice = usVoices.find(v => v.name.includes("Google US English")) || 
                       usVoices.find(v => v.name.includes("Zira")) || 
                       usVoices.find(v => v.name.includes("Samantha")) ||
                       usVoices.find(v => v.name.toLowerCase().includes("female")) ||
                       usVoices[0];
        utterance.pitch = 1.1;
      } else {
        patientVoice = usVoices.find(v => v.name.includes("David")) || 
                       usVoices.find(v => v.name.includes("Mark")) || 
                       usVoices.find(v => v.name.includes("Alex")) ||
                       usVoices.find(v => v.name.toLowerCase().includes("male")) ||
                       usVoices.find(v => !v.name.includes("Google US English") && !v.name.includes("Zira") && !v.name.includes("Samantha"));
        utterance.pitch = 0.9;
      }
      if (patientVoice) utterance.voice = patientVoice;
      utterance.rate = 1.0;
    }
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechSupported(true);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setUserInput((prev) => {
          const cleanPrev = prev.trim();
          return cleanPrev ? `${cleanPrev} ${transcript}` : transcript;
        });
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1500);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListeningToNotes(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNotes((prev) => {
          const cleanPrev = prev.trim();
          return cleanPrev ? `${cleanPrev} ${transcript}` : transcript;
        });
      };
      recognition.onerror = () => setIsListeningToNotes(false);
      recognition.onend = () => setIsListeningToNotes(false);
      notesRecognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) recognitionRef.current.stop();
    else try { recognitionRef.current.start(); } catch (error) { setIsListening(false); }
  };

  const toggleListeningToNotes = () => {
    if (!notesRecognitionRef.current) return;
    if (isListeningToNotes) notesRecognitionRef.current.stop();
    else try { notesRecognitionRef.current.start(); } catch (error) { setIsListeningToNotes(false); }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (gameState === GameState.ACTIVE && timeLeft !== null && timeLeft > 0 && !isTyping) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 0) return 0;
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, timeLeft, isTyping]);

  useEffect(() => {
    if (timeLeft === 0 && gameState === GameState.ACTIVE) {
      handleTimeout();
    }
  }, [timeLeft, gameState]);

  const startGame = async (type: ScenarioType) => {
    setIsProcessing(true);
    window.speechSynthesis.cancel();
    try {
      const newScenario = await generateScenario(type);
      setScenario(newScenario);
      setCurrentVitals({});
      setGameState(GameState.DISPATCH);
      setMessages([]);
      setFeedbackLog([]);
      setDebriefReport(null);
      setPhase("Dispatch");
      setNotes("");
      setMobileTab('chat');
      setShowHandwriting(false);
      speak(newScenario.dispatchMessage, 'system', newScenario);
      if (isTimedMode) {
        // Updated Medical time to 12 minutes (720s), Trauma remains 10 minutes (600s)
        const duration = newScenario.type === 'TRAUMA' ? 600 : 720;
        setTimeLeft(duration);
      } else {
        setTimeLeft(null);
      }
    } catch (error: any) {
      alert(`Failed to start scenario: ${getUserFriendlyErrorMessage(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetGame = () => {
    window.speechSynthesis.cancel();
    setGameState(GameState.LOBBY);
    setScenario(null);
    setMessages([]);
    setCurrentVitals({});
    setDebriefReport(null);
    setTimeLeft(null);
    setIsTyping(false);
    setIsHintModalOpen(false);
    setIsReportChecklistOpen(false);
    setNotes("");
    setShowHandwriting(false);
  };

  const handleDispatchAccept = () => {
    window.speechSynthesis.cancel();
    setGameState(GameState.ACTIVE);
    const introText = `DISPATCH: ${scenario?.dispatchMessage}\n\nYou arrive on scene. What do you do?`;
    addMessage('system', introText);
    speak(`You arrive on scene. The environment is ${scenario?.environment}. What do you do?`, 'system');
  };

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random().toString(),
      role, content, timestamp: Date.now()
    }]);
  };

  const handleTimeout = () => {
    const msg = "TIME EXPIRED: You failed to initiate transport within the required time limit.";
    addMessage('system', msg);
    speak(msg, 'system');
    finishScenario(true);
  };

  const handleBeginTransport = () => {
    if (isProcessing) return;
    setGameState(GameState.TRANSPORT);
    setPhase("En Route");
    const msg = "You load the patient and initiate transport to the nearest facility.";
    addMessage('system', msg);
    speak(msg, 'system');
  };

  const handleCallHospital = () => {
    setIsReportChecklistOpen(true);
    const msg = "RADIO CONNECTED: You are now speaking to the receiving facility (Nurse/Physician). Please provide your report.";
    addMessage('system', msg);
    speak(msg, 'system');
    setUserInput("This is Unit 51 en route to your facility...");
    const inputEl = document.querySelector('textarea') as HTMLTextAreaElement;
    if(inputEl) inputEl.focus();
  };

  const handleArrive = () => {
    const msg = "We are arriving at the ED bay. Transferring care to nursing staff.";
    addMessage('user', msg);
    finishScenario(false);
  };

  const finishScenario = async (isTimeout: boolean = false) => {
    if (!scenario) return;
    setGameState(GameState.EVALUATING);
    setIsDebriefLoading(true);
    try {
        const history = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
        const report = await generateDebrief(scenario, history, isTimeout);
        setDebriefReport(report);
        setGameState(GameState.DEBRIEF);
    } catch (e) {
        setDebriefReport({
            passed: false, score: 0, criticalFailures: ["Error generating report"],
            feedbackSummary: getUserFriendlyErrorMessage(e), clinicalReasoning: "N/A"
        });
        setGameState(GameState.DEBRIEF);
    } finally {
        setIsDebriefLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1500);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !scenario || isProcessing) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    const input = userInput;
    setUserInput("");
    addMessage('user', input);
    setIsProcessing(true);
    window.speechSynthesis.cancel();
    try {
      const history = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
      const response = await processTurn(scenario, history, input);
      if (response.narrative) {
        addMessage('assistant', response.narrative);
        speak(response.narrative, 'assistant');
      }
      if (response.updatedVitals) setCurrentVitals(prev => ({ ...prev, ...response.updatedVitals }));
      if (response.phase) setPhase(response.phase);
      if (response.feedback) setFeedbackLog(prev => [...prev, response.feedback!]);
      if (response.criticalFail) setFeedbackLog(prev => [...prev, `CRITICAL FAIL: ${response.criticalFail}`]);
      if (response.isComplete) await finishScenario(false);
    } catch (error) {
      addMessage('system', `Connection error: ${getUserFriendlyErrorMessage(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGetHint = async () => {
    if (!scenario || isProcessing) return;
    setIsHintModalOpen(true);
    setIsHintLoading(true);
    setCurrentHint(null);
    try {
       const history = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
       const hint = await getHint(scenario, history);
       setCurrentHint(hint);
    } catch (e) {
      setCurrentHint(`Unable to retrieve a hint: ${getUserFriendlyErrorMessage(e)}`);
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleQuickAction = (text: string) => {
    setUserInput(text);
    const inputEl = document.querySelector('textarea') as HTMLTextAreaElement;
    if (inputEl) {
      inputEl.focus();
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1500);
    }
  };

  const handleOpenBag = (bagId: string) => setActiveBag(bagId);

  const handleEquipItem = (item: string) => {
    setActiveBag(null);
    setUserInput(`I am retrieving the ${item} to `);
    const inputEl = document.querySelector('textarea') as HTMLTextAreaElement;
    if (inputEl) {
      inputEl.focus();
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1500);
    }
  };

  const handleHandwritingSave = async (imageData: string) => {
    setIsTranscribing(true);
    try {
      const text = await transcribeHandwriting(imageData);
      setNotes((prev) => prev ? `${prev}\n${text}` : text);
      setShowHandwriting(false);
    } catch (error) {
      alert("Failed to read handwriting. Please try again or type.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderNotebookContent = () => {
    if (showHandwriting) {
      return (
        <HandwritingPad 
          onSave={handleHandwritingSave} 
          onCancel={() => setShowHandwriting(false)} 
          isProcessing={isTranscribing}
          className="flex-1 min-h-[300px]"
        />
      );
    }
    return (
      <div className="flex-1 flex flex-col min-h-[300px] relative bg-yellow-100 rounded-lg overflow-hidden border border-slate-600 shadow-inner">
         <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record vitals, history, and treatment notes here..."
            className="w-full flex-1 bg-transparent border-none p-4 text-sm text-slate-900 placeholder:text-slate-500 focus:ring-0 outline-none resize-none font-mono relative z-10 leading-relaxed"
          />
          <div className="absolute bottom-4 right-4 flex gap-2 z-20">
            {speechSupported && (
              <button 
                 onClick={toggleListeningToNotes}
                 className={`p-3 rounded-full shadow-lg border border-slate-700 transition-all ${
                    isListeningToNotes ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                 }`}
                 title="Voice Note"
              >
                 {isListeningToNotes ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            <button 
               onClick={() => setShowHandwriting(true)}
               className="p-3 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-full shadow-lg border border-slate-700 transition-all"
               title="Use Handwriting"
            >
               <PenLine size={20} />
            </button>
          </div>
      </div>
    );
  };

  if (gameState === GameState.LOBBY) {
    return (
      <div className="min-h-screen bg-gray-950 text-slate-200 flex items-center justify-center p-4 font-inter relative overflow-hidden">
        {/* Background Graphic */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <StarOfLife className="w-[80vw] h-[80vw] text-blue-800" />
        </div>

        {/* Disclaimer Modal */}
        {showDisclaimer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-gray-900 border-2 border-red-900 max-w-lg w-full p-8 rounded-xl shadow-2xl relative flex flex-col items-center text-center">
                <div className="hazard-stripe w-full h-2 absolute top-0 left-0"></div>
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
                   <AlertTriangle size={32} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">Training Disclaimer</h2>
                <div className="w-16 h-1 bg-red-600 rounded-full mb-6"></div>
                <p className="text-gray-300 leading-relaxed mb-8 text-sm">
                  The NREMT Scenario Emulator is not meant to replace actual EMT instructor monitored patient assessments. The AI used to generate, respond and critique the sample assessments is not a certified EMT instructor. Always defer to your instructor or local EMS protocols whenever there is a question regarding the assessment results.
                </p>
                <button
                  onClick={dismissDisclaimer}
                  className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-4 rounded-lg transition-colors border-2 border-red-700 uppercase tracking-wide shadow-lg"
                >
                  I Acknowledge
                </button>
             </div>
          </div>
        )}

        <div className="max-w-2xl w-full bg-gray-900 border-2 border-gray-700 p-8 rounded-lg shadow-2xl relative z-10">
          {/* Top Bar Decoration */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-blue-900 hazard-stripe border-b border-gray-800"></div>

          <div className="absolute top-8 right-8 flex items-center gap-2">
             <button onClick={() => setIsMuted(!isMuted)} className="text-slate-500 hover:text-blue-400 transition-colors">
               {isMuted ? <VolumeX size={20} /> : volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
             </button>
             <input 
               type="range" min="0" max="1" step="0.1" value={isMuted ? 0 : volume} 
               onChange={(e) => { setVolume(parseFloat(e.target.value)); if(parseFloat(e.target.value) > 0) setIsMuted(false); }}
               className="w-20 accent-blue-600 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
             />
          </div>

          <div className="flex justify-center mb-6 mt-6">
             <div className="p-4 bg-white rounded-full border-4 border-blue-900 shadow-xl relative overflow-hidden">
               <StarOfLife className="w-28 h-28 text-blue-800" />
             </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2 text-white uppercase tracking-tighter">
            NREMT Scenario Emulator
          </h1>
          <p className="text-blue-400 text-center mb-8 text-lg font-medium tracking-wide font-mono-display uppercase">
            Test your BLS assessment skills with <span className="whitespace-nowrap">AI-generated</span> patients.
          </p>

          <div className="flex flex-col items-center gap-2 mb-8 bg-gray-950 p-4 rounded border border-gray-700 inset-shadow">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={isTimedMode}
                    onChange={(e) => setIsTimedMode(e.target.checked)}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-600 bg-gray-800 checked:border-blue-600 checked:bg-blue-600 transition-all"
                  />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 peer-checked:opacity-100 text-white">
                    <CheckCircle2 size={12} />
                  </div>
                </div>
                <span className="text-gray-300 font-bold group-hover:text-blue-400 transition-colors uppercase text-sm">Timed Scenario Mode</span>
              </label>
              <button
                onClick={() => setShowTimerInfo(!showTimerInfo)}
                className="text-slate-500 hover:text-blue-400 transition-colors p-1 rounded-full hover:bg-gray-800"
              >
                <Info size={20} />
              </button>
            </div>
            {showTimerInfo && (
              <div className="max-w-md mx-auto mt-2 text-sm text-slate-400 text-center font-mono text-xs">
                TIMEOUTS: 12 MIN (MEDICAL) / 10 MIN (TRAUMA)
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => startGame(ScenarioType.MEDICAL)}
              disabled={isProcessing}
              className="group p-6 bg-blue-900 border-2 border-blue-700 hover:bg-blue-800 hover:border-blue-400 rounded transition-all flex flex-col items-center gap-3 shadow-lg"
            >
              <StarOfLife className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
              <span className="font-bold uppercase tracking-wider text-white">Medical</span>
            </button>
            
            <button 
              onClick={() => startGame(ScenarioType.TRAUMA)}
              disabled={isProcessing}
              className="group p-6 bg-red-900 border-2 border-red-700 hover:bg-red-800 hover:border-red-400 rounded transition-all flex flex-col items-center gap-3 shadow-lg"
            >
              <AlertTriangle className="w-8 h-8 text-white group-hover:scale-110 transition-transform" />
              <span className="font-bold uppercase tracking-wider text-white">Trauma</span>
            </button>

            <button 
              onClick={() => startGame(ScenarioType.RANDOM)}
              disabled={isProcessing}
              className="group p-6 bg-gray-800 border-2 border-gray-600 hover:bg-gray-700 hover:border-gray-400 rounded transition-all flex flex-col items-center gap-3 shadow-lg"
            >
              <AlertCircle size={32} className="text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="font-bold uppercase tracking-wider text-gray-200">Random</span>
            </button>
          </div>
          
          {isProcessing && (
             <div className="mt-6 text-center text-blue-400 animate-pulse font-mono uppercase tracking-widest text-sm">
               >> DOWNLOADING DISPATCH DATA...
             </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === GameState.DISPATCH) {
    return (
      <div className="min-h-screen bg-gray-950 text-slate-200 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-gray-900 border-2 border-gray-700 rounded-lg shadow-2xl overflow-hidden">
             
             {/* MDT Header Strip */}
             <div className="w-full h-4 bg-red-700 hazard-stripe-red flex items-center justify-center"></div>
             
             <div className="p-8">
                <div className="flex justify-between items-center mb-6 border-b-2 border-gray-800 pb-4">
                  <div className="flex flex-col">
                      <h2 className="text-3xl font-bold text-white uppercase tracking-widest font-mono-display">DISPATCH</h2>
                      <span className="text-xs text-red-500 font-bold font-mono animate-pulse">PRIORITY 1 TRAFFIC</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <button onClick={() => setIsMuted(!isMuted)} className="text-slate-500 hover:text-blue-400">
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                  </div>
                </div>
                
                <div className="bg-black p-6 rounded border-l-8 border-red-600 mb-8 font-mono shadow-inner">
                    <div className="text-xl text-yellow-400 leading-relaxed uppercase">
                      "{scenario?.dispatchMessage}"
                    </div>
                </div>

                <div className="flex flex-col gap-1 mb-8 text-sm font-mono">
                  <div className="flex justify-between bg-gray-800 p-2 px-3 border border-gray-700">
                      <span className="text-gray-400">LOC</span> 
                      <span className="text-white font-bold">{scenario?.environment}</span>
                  </div>
                  <div className="flex justify-between bg-gray-800 p-2 px-3 border border-gray-700">
                      <span className="text-gray-400">PT</span> 
                      <span className="text-white font-bold">{scenario?.patientAge} / {scenario?.patientGender}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleDispatchAccept}
                  className="w-full bg-blue-800 hover:bg-blue-700 text-white font-bold py-4 rounded shadow-lg transition-colors uppercase tracking-widest border-b-4 border-blue-950 active:border-b-0 active:translate-y-1"
                >
                  Respond En Route
                </button>
             </div>
        </div>
      </div>
    );
  }

  const isGameActive = gameState === GameState.ACTIVE || gameState === GameState.TRANSPORT;
  const getTabClass = (tab: 'chat' | 'vitals' | 'equipment' | 'notebook') => `flex-1 py-4 text-center font-bold text-xs uppercase tracking-wider border-t-4 transition-colors ${mobileTab === tab ? 'border-blue-500 text-blue-400 bg-gray-900' : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`;

  return (
    <div className="fixed inset-0 bg-gray-950 text-slate-200 flex flex-col md:flex-row overflow-hidden font-inter">
      
      <EquipmentModal isOpen={activeBag !== null} onClose={() => setActiveBag(null)} title={activeBag ? BAG_TITLES[activeBag] : ''} items={activeBag ? BAG_CONTENTS[activeBag] : []} onSelectItem={handleEquipItem} />
      <DebriefModal isOpen={gameState === GameState.DEBRIEF || gameState === GameState.EVALUATING} isLoading={isDebriefLoading} report={debriefReport} onClose={resetGame} />
      <HintModal isOpen={isHintModalOpen} onClose={() => setIsHintModalOpen(false)} hint={currentHint} isLoading={isHintLoading} />
      <ReportChecklist isOpen={isReportChecklistOpen && gameState === GameState.TRANSPORT} onClose={() => setIsReportChecklistOpen(false)} />

      {/* MOBILE TABS */}
      <div className="md:hidden flex bg-gray-900 border-b border-gray-700 shrink-0 z-30 shadow-md">
        <button onClick={() => setMobileTab('chat')} className={getTabClass('chat')}><div className="flex flex-col items-center gap-1"><MessageSquare size={18} /> SCENE</div></button>
        <button onClick={() => setMobileTab('vitals')} className={getTabClass('vitals')}><div className="flex flex-col items-center gap-1"><Activity size={18} /> VITALS</div></button>
        <button onClick={() => setMobileTab('equipment')} className={getTabClass('equipment')}><div className="flex flex-col items-center gap-1"><BriefcaseMedical size={18} /> KIT</div></button>
        <button onClick={() => setMobileTab('notebook')} className={getTabClass('notebook')}><div className="flex flex-col items-center gap-1"><NotebookPen size={18} /> NOTES</div></button>
      </div>

      {/* LEFT SIDEBAR */}
      <div className={`bg-gray-900 border-r border-gray-700 flex-col p-4 overflow-y-auto shrink-0 ${mobileTab === 'vitals' ? 'flex flex-1 w-full min-h-0' : 'hidden md:flex md:w-80 shadow-2xl z-20'}`}>
        <div className="mb-6 border-b-2 border-gray-700 pb-4">
          <div className="flex items-center gap-3 mb-2">
             <div className="bg-blue-800 rounded p-1.5 border border-blue-600"><Truck size={20} className="text-white"/></div>
             <div>
               <h1 className="font-bold text-lg text-white tracking-widest font-mono-display">MDT 5.0</h1>
               <div className="text-[10px] font-mono text-blue-400">UNIT 51 | ONLINE</div>
             </div>
          </div>
          
          <div className="flex items-center gap-2 bg-black p-2 rounded border border-gray-700">
             <button onClick={() => setIsMuted(!isMuted)} className="text-gray-500 hover:text-blue-400 transition-colors">
               {isMuted ? <VolumeX size={16} /> : volume === 0 ? <VolumeX size={16} /> : volume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />}
             </button>
             <input type="range" min="0" max="1" step="0.1" value={isMuted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); if(parseFloat(e.target.value) > 0) setIsMuted(false); }} className="w-full accent-blue-600 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer" />
          </div>
        </div>

        <VitalMonitor vitals={currentVitals} className="mb-6 flex-1 md:flex-none" />

        <div className="hidden md:flex flex-col flex-1 min-h-[200px] mb-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2 tracking-widest">
             <NotebookPen size={12} /> Field Notes
          </h3>
          {renderNotebookContent()}
        </div>

        <div className="bg-gray-800 rounded p-3 border border-gray-700 mb-4 shrink-0 shadow-inner">
           <h3 className="text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-widest">STATUS</h3>
           <div className={`${gameState === GameState.TRANSPORT ? 'text-amber-400 animate-pulse' : 'text-blue-400'} font-bold text-lg flex items-center gap-2 uppercase font-mono`}>
             {gameState === GameState.TRANSPORT && <Ambulance size={20} />}
             {phase}
           </div>
        </div>

        <div className="mt-auto pt-4 border-t border-gray-700 shrink-0 hidden md:block">
          <button onClick={resetGame} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 py-3 rounded font-bold transition-colors border border-gray-700 hover:border-red-800 uppercase tracking-widest text-xs">
            <RotateCcw size={14} /> Abort Scenario
          </button>
        </div>
      </div>

      {/* MOBILE EQUIPMENT */}
      <div className={`flex-col bg-gray-900 p-4 overflow-y-auto min-h-0 ${mobileTab === 'equipment' ? 'flex flex-1' : 'hidden'} md:hidden`}>
         <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 uppercase font-mono-display border-b border-gray-800 pb-2">
           <BriefcaseMedical className="text-blue-500"/> Equipment
         </h2>
         {isGameActive ? <EquipmentToolbar onOpenBag={handleOpenBag} disabled={isProcessing} vertical /> : <div className="text-gray-500 text-center mt-10">Scenario not active.</div>}
      </div>

      {/* MOBILE NOTEBOOK */}
      <div className={`flex-col bg-gray-900 p-4 min-h-0 ${mobileTab === 'notebook' ? 'flex flex-1' : 'hidden'} md:hidden`}>
         <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 uppercase font-mono-display border-b border-gray-800 pb-2">
           <NotebookPen className="text-blue-500"/> Field Notes
         </h2>
         {renderNotebookContent()}
      </div>

      {/* MAIN CHAT */}
      <div className={`flex-col relative min-h-0 bg-gray-950 ${mobileTab === 'chat' ? 'flex flex-1' : 'hidden md:flex flex-1'}`}>
        <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-10"></div>
        
        {(gameState === GameState.ACTIVE || gameState === GameState.TRANSPORT) && timeLeft !== null && (
          <Timer timeLeft={timeLeft} isPaused={gameState === GameState.TRANSPORT || isTyping} />
        )}

        <ChatArea messages={messages} isProcessing={isProcessing} />

        <div className="p-3 bg-gray-900 border-t border-gray-700 z-20 flex flex-col gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
          <div className="flex gap-2">
             <textarea 
               value={userInput}
               onChange={handleInputChange}
               onKeyDown={handleKeyDown}
               placeholder={isGameActive ? "Explain your actions..." : "Scenario ended."}
               disabled={!isGameActive || isProcessing}
               rows={1}
               className="flex-1 bg-black border border-gray-600 text-gray-200 rounded px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 resize-none h-48 md:h-auto placeholder:text-gray-600 font-mono text-sm"
             />
             
             {isGameActive && speechSupported && (
               <button onClick={toggleListening} disabled={isProcessing} className={`px-3 rounded transition-colors flex items-center justify-center shrink-0 h-full max-h-[100px] max-w-[100px] self-start border ${isListening ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white'}`} title="Voice Input">
                 {isListening ? <MicOff size={20} /> : <Mic size={20} />}
               </button>
             )}

             {isGameActive && (
               <button onClick={handleGetHint} disabled={isProcessing} className="bg-amber-700 hover:bg-amber-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded px-3 transition-colors shrink-0 h-full max-h-[100px] max-w-[100px] self-start flex items-center justify-center border border-amber-600 shadow-lg" title="Get a Hint">
                 <Lightbulb size={20} />
               </button>
             )}

             <button onClick={handleSendMessage} disabled={!isGameActive || isProcessing || !userInput.trim()} className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded px-4 transition-colors shrink-0 h-full max-h-[100px] max-w-[100px] self-start flex items-center justify-center border border-blue-600 shadow-lg">
               <Send size={20} />
             </button>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto max-h-[40vh] md:max-h-none pr-1">
            {gameState === GameState.ACTIVE && (
              <div className="flex flex-col gap-2">
                <div className="hidden md:block"><EquipmentToolbar onOpenBag={handleOpenBag} disabled={isProcessing} /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><QuickActions onAction={handleQuickAction} disabled={isProcessing} /></div>
                  <button onClick={handleBeginTransport} disabled={isProcessing} className="bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white px-4 rounded border border-green-600 font-bold flex flex-col items-center justify-center min-w-[80px] shadow-lg transition-colors active:translate-y-0.5">
                    <Ambulance size={24} className="mb-1" />
                    <span className="text-[10px] uppercase text-center leading-tight font-mono">INITIATE<br/>TRANSPORT</span>
                  </button>
                </div>
              </div>
            )}

            {gameState === GameState.TRANSPORT && (
              <div className="flex gap-3 animate-in slide-in-from-bottom-2 flex-wrap">
                <button onClick={handleCallHospital} disabled={isProcessing} className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white py-3 rounded font-bold flex items-center justify-center gap-2 transition-colors min-w-[150px] shadow-lg border border-amber-600 uppercase tracking-wide text-sm">
                  <Radio size={18} /> Call Hospital
                </button>
                <button onClick={() => setIsReportChecklistOpen(!isReportChecklistOpen)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 rounded font-bold border border-gray-600 transition-colors shadow" title="Toggle Checklist">
                  <Info size={20} />
                </button>
                <button onClick={handleArrive} disabled={isProcessing} className="flex-1 bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded font-bold flex items-center justify-center gap-2 transition-colors min-w-[150px] shadow-lg border border-green-600 uppercase tracking-wide text-sm">
                  <CheckCircle2 size={18} /> Arrive
                </button>
              </div>
            )}

            <button onClick={resetGame} className="md:hidden w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 py-3 rounded font-bold transition-colors border border-gray-700 mt-2 uppercase tracking-wide text-xs">
               <RotateCcw size={14} /> Abort Scenario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

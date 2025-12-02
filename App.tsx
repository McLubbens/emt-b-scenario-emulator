
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
  
  // Attempt to parse nested JSON error message if present
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
  } catch (e) {
    // Fallback to original message if parsing fails
  }

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
  
  // Accumulated hidden feedback for the debrief
  const [feedbackLog, setFeedbackLog] = useState<string[]>([]);
  
  // Debrief State
  const [debriefReport, setDebriefReport] = useState<DebriefReport | null>(null);
  const [isDebriefLoading, setIsDebriefLoading] = useState(false);

  // Hint State
  const [isHintModalOpen, setIsHintModalOpen] = useState(false);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);

  // Report Checklist State
  const [isReportChecklistOpen, setIsReportChecklistOpen] = useState(false);

  // Bag State
  const [activeBag, setActiveBag] = useState<string | null>(null);

  // Timer State
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings State
  const [isTimedMode, setIsTimedMode] = useState(false);
  const [showTimerInfo, setShowTimerInfo] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Audio State
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Speech Recognition State (Main Chat)
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Speech Recognition State (Field Notes)
  const [isListeningToNotes, setIsListeningToNotes] = useState(false);
  const notesRecognitionRef = useRef<any>(null);

  // Notebook State
  const [notes, setNotes] = useState("");
  const [showHandwriting, setShowHandwriting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Mobile Tab State
  const [mobileTab, setMobileTab] = useState<'chat' | 'vitals' | 'equipment' | 'notebook'>('chat');

  // Load Voices
  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Check Disclaimer Session Storage
  useEffect(() => {
    const hasSeen = sessionStorage.getItem('nremt_disclaimer_seen');
    if (!hasSeen) {
      setShowDisclaimer(true);
    }
  }, []);

  const dismissDisclaimer = () => {
    sessionStorage.setItem('nremt_disclaimer_seen', 'true');
    setShowDisclaimer(false);
  };

  // Text-to-Speech Helper
  const speak = (text: string, role: 'system' | 'assistant', contextScenario?: ScenarioData | null) => {
    if (isMuted || !text) return;
    
    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;

    const activeScenario = contextScenario || scenario;

    // Helper to find US voices
    const usVoices = voices.filter(v => v.lang === 'en-US');
    const fallbackVoices = voices.filter(v => v.lang.startsWith('en'));

    // Voice Selection Logic
    if (role === 'system') {
      // Dispatch / System: Faster, slightly higher pitch
      // Prioritize "Google US English" or other US voices
      const dispatchVoice = usVoices.find(v => v.name === "Google US English") || 
                            usVoices.find(v => v.name.includes("Samantha")) || 
                            usVoices[0] ||
                            fallbackVoices[0];
      
      if (dispatchVoice) utterance.voice = dispatchVoice;
      utterance.rate = 1.1;
      utterance.pitch = 1.05;
    } else if (role === 'assistant' && activeScenario) {
      // Patient / Scene: Match gender
      const isFemale = activeScenario.patientGender.toLowerCase().includes('female') || 
                       activeScenario.patientGender.toLowerCase() === 'f';
      
      let patientVoice;
      if (isFemale) {
        // US Female
        patientVoice = usVoices.find(v => v.name.includes("Google US English")) || 
                       usVoices.find(v => v.name.includes("Zira")) || 
                       usVoices.find(v => v.name.includes("Samantha")) ||
                       usVoices.find(v => v.name.toLowerCase().includes("female")) ||
                       usVoices[0];
        utterance.pitch = 1.1;
      } else {
        // US Male
        // Look for "David", "Mark" (Windows), "Alex" (Mac) or generic male
        patientVoice = usVoices.find(v => v.name.includes("David")) || 
                       usVoices.find(v => v.name.includes("Mark")) || 
                       usVoices.find(v => v.name.includes("Alex")) ||
                       usVoices.find(v => v.name.toLowerCase().includes("male")) ||
                       // Fallback: pick a US voice that isn't the standard female ones
                       usVoices.find(v => !v.name.includes("Google US English") && !v.name.includes("Zira") && !v.name.includes("Samantha"));
        
        utterance.pitch = 0.9;
      }

      if (patientVoice) utterance.voice = patientVoice;
      utterance.rate = 1.0;
    }

    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition Setup (Main Chat)
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechSupported(true);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

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

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Speech Recognition Setup (Notes)
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListeningToNotes(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNotes((prev) => {
          const cleanPrev = prev.trim();
          return cleanPrev ? `${cleanPrev} ${transcript}` : transcript;
        });
      };

      recognition.onerror = (event: any) => {
        console.error('Notes Speech recognition error:', event.error);
        setIsListeningToNotes(false);
      };

      recognition.onend = () => {
        setIsListeningToNotes(false);
      };

      notesRecognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        setIsListening(false);
      }
    }
  };

  const toggleListeningToNotes = () => {
    if (!notesRecognitionRef.current) return;

    if (isListeningToNotes) {
      notesRecognitionRef.current.stop();
    } else {
      try {
        notesRecognitionRef.current.start();
      } catch (error) {
        console.error("Error starting notes speech recognition:", error);
        setIsListeningToNotes(false);
      }
    }
  };

  // Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    // Timer runs only if active (SCENE), has time left, AND user is NOT typing
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

  // Handle Timeout Trigger
  useEffect(() => {
    // Only trigger timeout failure if in ACTIVE (Scene) mode. 
    // Once in TRANSPORT, the 'initiate transport' requirement is met.
    if (timeLeft === 0 && gameState === GameState.ACTIVE) {
      handleTimeout();
    }
  }, [timeLeft, gameState]);

  const startGame = async (type: ScenarioType) => {
    setIsProcessing(true);
    // Stop any existing speech when starting new
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
      setMobileTab('chat'); // Default to chat
      setShowHandwriting(false);
      
      // Read Dispatch
      speak(newScenario.dispatchMessage, 'system', newScenario);

      if (isTimedMode) {
        // Set timer based on scenario type: Medical=12m (720s), Trauma=10m (600s)
        const duration = newScenario.type === 'TRAUMA' ? 600 : 720;
        setTimeLeft(duration);
      } else {
        setTimeLeft(null);
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = getUserFriendlyErrorMessage(error);
      alert(`Failed to start scenario: ${errorMsg}`);
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
    // Speak the intro, but maybe simplify what is spoken vs read
    speak(`You arrive on scene. The environment is ${scenario?.environment}. What do you do?`, 'system');
  };

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
    const newMsg: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(),
      role,
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMsg]);
  };

  const handleTimeout = () => {
    const msg = "TIME EXPIRED: You failed to initiate transport within the required time limit.";
    addMessage('system', msg);
    speak(msg, 'system');
    finishScenario(true);
  };

  const handleBeginTransport = () => {
    if (isProcessing) return;
    
    // Transition to Transport State
    setGameState(GameState.TRANSPORT);
    setPhase("En Route");
    const msg = "You load the patient and initiate transport to the nearest facility.";
    addMessage('system', msg);
    speak(msg, 'system');
    
    // We don't reset time left, but we stop the fail condition since transport has started.
    // The user now needs to do the radio report.
  };

  const handleCallHospital = () => {
    setIsReportChecklistOpen(true);
    const msg = "RADIO CONNECTED: You are now speaking to the receiving facility (Nurse/Physician). Please provide your report.";
    addMessage('system', msg);
    speak(msg, 'system');
    
    // Insert a prompt to the user input to help them start
    setUserInput("This is Unit 51 en route to your facility...");
    const inputEl = document.querySelector('textarea') as HTMLTextAreaElement;
    if(inputEl) inputEl.focus();
  };

  const handleArrive = () => {
    const msg = "We are arriving at the ED bay. Transferring care to nursing staff.";
    addMessage('user', msg);
    // No need to speak user actions generally, or maybe user preference? 
    // Current requirement: "read dispatch and all responses". Usually user voice is not read back.
    finishScenario(false);
  };

  const finishScenario = async (isTimeout: boolean = false) => {
    if (!scenario) return;
    setGameState(GameState.EVALUATING); // Trigger modal with loading state
    setIsDebriefLoading(true);
    try {
        const history = messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content }));
        
        const report = await generateDebrief(scenario, history, isTimeout);
        setDebriefReport(report);
        setGameState(GameState.DEBRIEF);
    } catch (e) {
        console.error("Failed to generate debrief", e);
        // Fallback if AI fails
        setDebriefReport({
            passed: false,
            score: 0,
            criticalFailures: ["Error generating report"],
            feedbackSummary: getUserFriendlyErrorMessage(e),
            clinicalReasoning: "N/A"
        });
        setGameState(GameState.DEBRIEF);
    } finally {
        setIsDebriefLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    
    // Pause timer logic
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    // Resume timer after 1.5 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !scenario || isProcessing) return;

    // Clear typing state immediately upon send
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);

    const input = userInput;
    setUserInput("");
    addMessage('user', input);
    setIsProcessing(true);

    // Stop any current speech when user sends new message
    window.speechSynthesis.cancel();

    try {
      const history = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await processTurn(scenario, history, input);

      if (response.narrative) {
        addMessage('assistant', response.narrative);
        speak(response.narrative, 'assistant');
      }

      if (response.updatedVitals) {
        setCurrentVitals(prev => ({ ...prev, ...response.updatedVitals }));
      }

      if (response.phase) {
        setPhase(response.phase);
      }

      if (response.feedback) {
         setFeedbackLog(prev => [...prev, response.feedback!]);
      }

      if (response.criticalFail) {
         setFeedbackLog(prev => [...prev, `CRITICAL FAIL: ${response.criticalFail}`]);
      }

      if (response.isComplete) {
        await finishScenario(false);
      }

    } catch (error) {
      console.error(error);
      const errorMsg = getUserFriendlyErrorMessage(error);
      addMessage('system', `Connection error: ${errorMsg}`);
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
       const history = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));
       
       const hint = await getHint(scenario, history);
       setCurrentHint(hint);
    } catch (e) {
      console.error(e);
      const errorMsg = getUserFriendlyErrorMessage(e);
      setCurrentHint(`Unable to retrieve a hint: ${errorMsg}`);
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

  const handleOpenBag = (bagId: string) => {
    setActiveBag(bagId);
  };

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
      console.error("Transcription error:", error);
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

  // --- RENDERERS ---

  if (gameState === GameState.LOBBY) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4">
        
        {/* Disclaimer Modal */}
        {showDisclaimer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="bg-slate-900 border border-amber-500/30 max-w-lg w-full p-8 rounded-2xl shadow-2xl relative flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-amber-900/20 rounded-full flex items-center justify-center mb-4">
                   <AlertTriangle size={32} className="text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-100 mb-2">Disclaimer</h2>
                <div className="w-16 h-1 bg-amber-500/50 rounded-full mb-6"></div>
                <p className="text-slate-300 leading-relaxed mb-8">
                  The NREMT Scenario Emulator is not meant to replace actual EMT instructor monitored patient assessments. The AI used to generate, respond and critique the sample assessments is not a certified EMT instructor. Always defer to your instructor or local EMS protocols whenever there is a question regarding the assessment results.
                </p>
                <button
                  onClick={dismissDisclaimer}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-colors border border-slate-700 hover:border-blue-500 uppercase tracking-wide"
                >
                  I Understand
                </button>
             </div>
          </div>
        )}

        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative">
          
          {/* Volume Control in Lobby */}
          <div className="absolute top-8 right-8 flex items-center gap-2">
             <button 
               onClick={() => setIsMuted(!isMuted)} 
               className="text-slate-500 hover:text-blue-400 transition-colors"
             >
               {isMuted ? <VolumeX size={20} /> : volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
             </button>
             <input 
               type="range" 
               min="0" 
               max="1" 
               step="0.1" 
               value={isMuted ? 0 : volume} 
               onChange={(e) => {
                 setVolume(parseFloat(e.target.value));
                 if(parseFloat(e.target.value) > 0) setIsMuted(false);
               }}
               className="w-20 accent-blue-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
             />
          </div>

          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-600/20 rounded-full">
              <Ambulance size={64} className="text-blue-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            NREMT Scenario Emulator
          </h1>
          <p className="text-slate-400 text-center mb-8 text-lg">
            Test your BLS assessment skills with <span className="whitespace-nowrap">AI-generated</span> patients.
          </p>

          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={isTimedMode}
                    onChange={(e) => setIsTimedMode(e.target.checked)}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-600 bg-slate-800 checked:border-blue-500 checked:bg-blue-500 transition-all"
                  />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 peer-checked:opacity-100 text-white">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
                <span className="text-slate-300 font-semibold group-hover:text-blue-400 transition-colors">Timed Scenario</span>
              </label>
              <button
                onClick={() => setShowTimerInfo(!showTimerInfo)}
                className="text-slate-500 hover:text-blue-400 transition-colors p-1 rounded-full hover:bg-slate-800"
                title="Click for details"
              >
                <Info size={20} />
              </button>
            </div>
            
            {showTimerInfo && (
              <div className="max-w-md mx-auto mt-2 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg text-sm text-blue-200 text-center animate-in slide-in-from-top-2 duration-200">
                Timed scenarios will allow 12 minutes for medical calls and 10 minutes for trauma calls to simulate the NREMT psychomotor exam time limits.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => startGame(ScenarioType.MEDICAL)}
              disabled={isProcessing}
              className="group p-6 bg-slate-800 hover:bg-blue-900/30 border border-slate-700 hover:border-blue-500 rounded-xl transition-all flex flex-col items-center gap-3"
            >
              <Stethoscope size={32} className="text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="font-bold">Medical</span>
            </button>
            
            <button 
              onClick={() => startGame(ScenarioType.TRAUMA)}
              disabled={isProcessing}
              className="group p-6 bg-slate-800 hover:bg-red-900/30 border border-slate-700 hover:border-red-500 rounded-xl transition-all flex flex-col items-center gap-3"
            >
              <Skull size={32} className="text-red-400 group-hover:scale-110 transition-transform" />
              <span className="font-bold">Trauma</span>
            </button>

            <button 
              onClick={() => startGame(ScenarioType.RANDOM)}
              disabled={isProcessing}
              className="group p-6 bg-slate-800 hover:bg-purple-900/30 border border-slate-700 hover:border-purple-500 rounded-xl transition-all flex flex-col items-center gap-3"
            >
              <AlertCircle size={32} className="text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="font-bold">Random</span>
            </button>
          </div>
          
          {isProcessing && (
             <div className="mt-6 text-center text-slate-400 animate-pulse">
               Generating scenario from dispatch...
             </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === GameState.DISPATCH) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border-2 border-blue-900/50 p-8 rounded-lg shadow-[0_0_50px_rgba(37,99,235,0.2)]">
           <div className="flex justify-between items-center mb-4 border-b border-blue-900 pb-2">
             <h2 className="text-xl font-bold text-blue-400 uppercase tracking-widest">Incoming Dispatch</h2>
             <div className="flex items-center gap-2">
                <button onClick={() => setIsMuted(!isMuted)} className="text-blue-400 hover:text-blue-300">
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
             </div>
           </div>
           
           <div className="font-mono text-lg mb-8 leading-relaxed">
             "{scenario?.dispatchMessage}"
           </div>
           <div className="flex flex-col gap-2 mb-8 text-sm text-slate-400 bg-slate-950 p-4 rounded border border-slate-800">
             <div className="flex justify-between"><span>Location:</span> <span className="text-slate-200">{scenario?.environment}</span></div>
             <div className="flex justify-between"><span>Patient Age:</span> <span className="text-slate-200">{scenario?.patientAge}</span></div>
             <div className="flex justify-between"><span>Gender:</span> <span className="text-slate-200">{scenario?.patientGender}</span></div>
             {isTimedMode ? (
               <div className="flex justify-between"><span>Time Limit:</span> <span className="text-red-400 font-bold">{scenario?.type === 'MEDICAL' ? '12:00' : '10:00'}</span></div>
             ) : (
               <div className="flex justify-between"><span>Time Limit:</span> <span className="text-green-400 font-bold">Untimed</span></div>
             )}
           </div>
           <button 
             onClick={handleDispatchAccept}
             className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded shadow-lg transition-colors uppercase tracking-wider"
           >
             Acknowledge & Respond
           </button>
        </div>
      </div>
    );
  }

  const isGameActive = gameState === GameState.ACTIVE || gameState === GameState.TRANSPORT;

  // Layout helper: Mobile Tabs
  const getTabClass = (tab: 'chat' | 'vitals' | 'equipment' | 'notebook') => `flex-1 py-3 text-center font-bold text-sm uppercase tracking-wider border-b-2 transition-colors ${mobileTab === tab ? 'border-blue-500 text-blue-400 bg-slate-900' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`;

  // Notebook Content Renderer (Shared)
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
      <div className="flex-1 flex flex-col min-h-[300px] relative bg-yellow-100 rounded-lg overflow-hidden border border-slate-700">
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
                    isListeningToNotes 
                      ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
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

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-200 flex flex-col md:flex-row overflow-hidden">
      
      <EquipmentModal 
        isOpen={activeBag !== null}
        onClose={() => setActiveBag(null)}
        title={activeBag ? BAG_TITLES[activeBag] : ''}
        items={activeBag ? BAG_CONTENTS[activeBag] : []}
        onSelectItem={handleEquipItem}
      />

      <DebriefModal
        isOpen={gameState === GameState.DEBRIEF || gameState === GameState.EVALUATING}
        isLoading={isDebriefLoading}
        report={debriefReport}
        onClose={resetGame}
      />

      <HintModal 
        isOpen={isHintModalOpen}
        onClose={() => setIsHintModalOpen(false)}
        hint={currentHint}
        isLoading={isHintLoading}
      />

      <ReportChecklist 
        isOpen={isReportChecklistOpen && gameState === GameState.TRANSPORT}
        onClose={() => setIsReportChecklistOpen(false)}
      />

      {/* MOBILE TABS */}
      <div className="md:hidden flex bg-slate-950 border-b border-slate-800 shrink-0 z-30">
        <button onClick={() => setMobileTab('chat')} className={getTabClass('chat')}>
            <div className="flex items-center justify-center gap-2"><MessageSquare size={16} /> Scene</div>
        </button>
        <button onClick={() => setMobileTab('vitals')} className={getTabClass('vitals')}>
             <div className="flex items-center justify-center gap-2"><Activity size={16} /> Monitor</div>
        </button>
        <button onClick={() => setMobileTab('equipment')} className={getTabClass('equipment')}>
             <div className="flex items-center justify-center gap-2"><BriefcaseMedical size={16} /> Kit</div>
        </button>
        <button onClick={() => setMobileTab('notebook')} className={getTabClass('notebook')}>
             <div className="flex items-center justify-center gap-2"><NotebookPen size={16} /> Note</div>
        </button>
      </div>

      {/* LEFT SIDEBAR - VITALS & STATUS & NOTEBOOK */}
      <div className={`
        bg-slate-900 border-r border-slate-800 flex-col p-4 overflow-y-auto shrink-0
        ${mobileTab === 'vitals' ? 'flex flex-1 w-full min-h-0' : 'hidden md:flex md:w-80'}
      `}>
        <div className="mb-6">
          <h1 className="font-bold text-lg text-slate-100 mb-1">NREMT Emulator</h1>
          <div className="text-xs font-mono text-slate-500 mb-2">Unit 51 | {scenario?.type}</div>
          
          {/* Volume Control in Sidebar */}
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded border border-slate-800">
             <button 
               onClick={() => setIsMuted(!isMuted)} 
               className="text-slate-500 hover:text-blue-400 transition-colors"
             >
               {isMuted ? <VolumeX size={16} /> : volume === 0 ? <VolumeX size={16} /> : volume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />}
             </button>
             <input 
               type="range" 
               min="0" 
               max="1" 
               step="0.1" 
               value={isMuted ? 0 : volume} 
               onChange={(e) => {
                 setVolume(parseFloat(e.target.value));
                 if(parseFloat(e.target.value) > 0) setIsMuted(false);
               }}
               className="w-full accent-blue-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
             />
          </div>
        </div>

        <VitalMonitor vitals={currentVitals} className="mb-6 flex-1 md:flex-none" />

        {/* Notebook Section in Sidebar */}
        <div className="hidden md:flex flex-col flex-1 min-h-[200px] mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
             <NotebookPen size={14} /> Field Notes
          </h3>
          {renderNotebookContent()}
        </div>

        <div className="bg-slate-800/50 rounded p-4 border border-slate-700 mb-4 shrink-0">
           <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Current Phase</h3>
           <div className={`${gameState === GameState.TRANSPORT ? 'text-amber-400 animate-pulse' : 'text-blue-400'} font-bold text-lg flex items-center gap-2`}>
             {gameState === GameState.TRANSPORT && <Ambulance size={20} />}
             {phase}
           </div>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-800 shrink-0 hidden md:block">
          <button 
            onClick={resetGame}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-bold transition-colors border border-slate-700"
          >
            <RotateCcw size={16} />
            Abort Scenario
          </button>
        </div>
      </div>

      {/* MOBILE EQUIPMENT TAB */}
      <div className={`
        flex-col bg-slate-900 p-4 overflow-y-auto min-h-0
        ${mobileTab === 'equipment' ? 'flex flex-1' : 'hidden'} md:hidden
      `}>
         <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
           <BriefcaseMedical className="text-blue-400"/> Equipment
         </h2>
         {isGameActive ? (
           <EquipmentToolbar onOpenBag={handleOpenBag} disabled={isProcessing} vertical />
         ) : (
           <div className="text-slate-500 text-center mt-10">Scenario not active.</div>
         )}
      </div>

      {/* MOBILE NOTEBOOK TAB */}
      <div className={`
        flex-col bg-slate-900 p-4 min-h-0
        ${mobileTab === 'notebook' ? 'flex flex-1' : 'hidden'} md:hidden
      `}>
         <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
           <NotebookPen className="text-blue-400"/> Field Notes
         </h2>
         {renderNotebookContent()}
      </div>

      {/* MAIN CONTENT - CHAT */}
      <div className={`
        flex-col relative min-h-0
        ${mobileTab === 'chat' ? 'flex flex-1' : 'hidden md:flex flex-1'}
      `}>
        <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-slate-950 to-transparent pointer-events-none z-10"></div>
        
        {/* Timer */}
        {(gameState === GameState.ACTIVE || gameState === GameState.TRANSPORT) && timeLeft !== null && (
          <Timer timeLeft={timeLeft} isPaused={gameState === GameState.TRANSPORT || isTyping} />
        )}

        <ChatArea messages={messages} isProcessing={isProcessing} />

        {/* INPUT AREA */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 z-20 flex flex-col gap-3">
          
          {/* 1. Input Row - Always Visible */}
          <div className="flex gap-2">
             <textarea 
               value={userInput}
               onChange={handleInputChange}
               onKeyDown={handleKeyDown}
               placeholder={isGameActive ? "Explain your actions..." : "Scenario ended."}
               disabled={!isGameActive || isProcessing}
               rows={1}
               className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 resize-none h-48 md:h-auto"
             />
             
             {/* Speech-to-Text Button */}
             {isGameActive && speechSupported && (
               <button
                 onClick={toggleListening}
                 disabled={isProcessing}
                 className={`px-3 rounded-lg transition-colors flex items-center justify-center shrink-0 h-full max-h-[100px] max-w-[100px] self-start ${
                    isListening 
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                 }`}
                 title={isListening ? "Stop Recording" : "Use Voice Input"}
               >
                 {isListening ? <MicOff size={20} /> : <Mic size={20} />}
               </button>
             )}

             {isGameActive && (
               <button 
                 onClick={handleGetHint}
                 disabled={isProcessing}
                 className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg px-3 transition-colors shrink-0 h-full max-h-[100px] max-w-[100px] self-start flex items-center justify-center"
                 title="Get a Hint"
               >
                 <Lightbulb size={20} />
               </button>
             )}

             <button 
               onClick={handleSendMessage}
               disabled={!isGameActive || isProcessing || !userInput.trim()}
               className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg px-4 transition-colors shrink-0 h-full max-h-[100px] max-w-[100px] self-start flex items-center justify-center"
             >
               <Send size={20} />
             </button>
          </div>

          {/* 2. Actions Container - Scrollable on small screens to prevent full screen takeover */}
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[40vh] md:max-h-none pr-1">
            {/* ACTIONS TOOLBAR */}
            {gameState === GameState.ACTIVE && (
              <div className="flex flex-col gap-2">
                <div className="hidden md:block">
                   <EquipmentToolbar onOpenBag={handleOpenBag} disabled={isProcessing} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <QuickActions onAction={handleQuickAction} disabled={isProcessing} />
                  </div>
                  <button
                    onClick={handleBeginTransport}
                    disabled={isProcessing}
                    className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-4 rounded-lg border border-green-600 font-bold flex flex-col items-center justify-center min-w-[80px] shadow-lg transition-colors"
                  >
                    <Ambulance size={24} className="mb-1" />
                    <span className="text-[10px] uppercase text-center leading-tight">Begin<br/>Transport</span>
                  </button>
                </div>
              </div>
            )}

            {gameState === GameState.TRANSPORT && (
              <div className="flex gap-3 animate-in slide-in-from-bottom-2 flex-wrap">
                <button
                  onClick={handleCallHospital}
                  disabled={isProcessing}
                  className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors min-w-[150px]"
                >
                  <Radio size={20} />
                  Call Hospital
                </button>
                
                <button
                  onClick={() => setIsReportChecklistOpen(!isReportChecklistOpen)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 rounded-lg font-bold border border-slate-700 transition-colors"
                  title="Toggle Checklist"
                >
                  <Info size={20} />
                </button>

                <button
                  onClick={handleArrive}
                  disabled={isProcessing}
                  className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors min-w-[150px]"
                >
                  <CheckCircle2 size={20} />
                  Arrive
                </button>
              </div>
            )}

            {/* Mobile Abort Button */}
            <button 
               onClick={resetGame}
               className="md:hidden w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 py-3 rounded-lg font-bold transition-colors border border-slate-700 mt-2"
            >
               <RotateCcw size={16} />
               Abort Scenario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

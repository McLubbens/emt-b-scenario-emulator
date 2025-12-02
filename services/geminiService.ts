
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ScenarioType, ScenarioData, Vitals, TurnResponse, DebriefReport, NREMT_CRITICAL_CRITERIA } from "../types";

// Safety settings to prevent blocking of medical/trauma content
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

const MEDICAL_PATHOLOGIES = [
  "Chest Pain (Possible Acute Myocardial Infarction)",
  "Chest Pain (Angina Pectoris)",
  "Congestive Heart Failure (CHF) / Pulmonary Edema",
  "Respiratory Distress (COPD Exacerbation)",
  "Respiratory Distress (Severe Asthma)",
  "Respiratory Distress (Pneumonia)",
  "Stroke / CVA (Ischemic)",
  "Stroke / CVA (Hemorrhagic)",
  "Altered Mental Status (Opioid Overdose)",
  "Altered Mental Status (Hypoglycemia)",
  "Altered Mental Status (Sepsis)",
  "Acute Abdominal Pain (Appendicitis)",
  "Acute Abdominal Pain (GI Bleed)",
  "Acute Abdominal Pain (Ectopic Pregnancy - Female)",
  "Acute Abdominal Pain (Abdominal Aortic Aneurysm)",
  "Anaphylaxis / Severe Allergic Reaction",
  "Seizure (Status Epilepticus)",
  "Seizure (Post-ictal state)",
  "Heat Stroke / Heat Exhaustion",
  "Hypothermia",
  "Diabetic Ketoacidosis (DKA)",
  "Syncope (Cardiac origin)"
];

const TRAUMA_PATHOLOGIES = [
  "Head Injury (Traumatic Brain Injury / Subdural Hematoma)",
  "Chest Injury (Tension Pneumothorax)",
  "Chest Injury (Flail Chest)",
  "Abdominal Injury (Evisceration)",
  "Abdominal Injury (Blunt Trauma/Internal Bleeding)",
  "Extremity Trauma (Open Femur Fracture)",
  "Extremity Trauma (Amputation)",
  "Penetrating Trauma (Gunshot Wound to Chest)",
  "Penetrating Trauma (Stab wound to Abdomen)",
  "Multi-system Trauma (Fall from height)",
  "Burn Injury (Thermal - High BSA)",
  "Neck Injury (Laceration with bleeding control)"
];

// Define properties once to reuse in both strict and partial schemas
// Changed INTEGER to NUMBER to be more robust against float returns (e.g. 98.0)
const VITALS_PROPERTIES = {
  hr: { type: Type.NUMBER },
  bpSystolic: { type: Type.NUMBER },
  bpDiastolic: { type: Type.NUMBER },
  rr: { type: Type.NUMBER },
  spo2: { type: Type.NUMBER },
  etco2: { type: Type.NUMBER },
  bgl: { type: Type.NUMBER },
  temp: { type: Type.NUMBER },
  skin: { type: Type.STRING },
  pupils: { type: Type.STRING },
  loc: { type: Type.STRING },
};

const SCENARIO_VITALS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: VITALS_PROPERTIES,
  required: ["hr", "bpSystolic", "bpDiastolic", "rr", "spo2", "skin", "pupils", "loc"],
};

const PARTIAL_VITALS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: VITALS_PROPERTIES,
  required: [], // No required fields allows partial updates
};

const SCENARIO_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    dispatchMessage: { type: Type.STRING },
    difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
    type: { type: Type.STRING, enum: ["MEDICAL", "TRAUMA"] },
    initialVitals: SCENARIO_VITALS_SCHEMA,
    environment: { type: Type.STRING },
    patientGender: { type: Type.STRING },
    patientAge: { type: Type.INTEGER },
  },
  required: ["title", "dispatchMessage", "difficulty", "type", "initialVitals", "environment", "patientGender", "patientAge"],
};

const TURN_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    narrative: { type: Type.STRING, description: "The description of what happens next, what the patient says, or what the EMT sees." },
    updatedVitals: PARTIAL_VITALS_SCHEMA,
    feedback: { type: Type.STRING, description: "Constructive feedback on the user's last action based on NREMT standards. Return an empty string if no feedback is needed." },
    phase: { type: Type.STRING, description: "Current phase of assessment (e.g., Scene Size-up, Primary, History, Transport)." },
    criticalFail: { type: Type.STRING, description: "If the user performed a dangerous action, describe it here. Otherwise return an empty string." },
    isComplete: { type: Type.BOOLEAN, description: "True ONLY if the user has arrived at the hospital AND transferred care." },
  },
  // Require all fields to enforce explicit empty strings instead of nulls/undefined which can break parsing
  required: ["narrative", "phase", "isComplete", "feedback", "criticalFail"],
};

const DEBRIEF_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    passed: { type: Type.BOOLEAN },
    score: { type: Type.NUMBER },
    criticalFailures: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of specific NREMT criteria violated."
    },
    feedbackSummary: { type: Type.STRING },
    clinicalReasoning: { type: Type.STRING }
  },
  required: ["passed", "score", "criticalFailures", "feedbackSummary", "clinicalReasoning"]
};

// Retry Logic Helper
const generateContentWithRetry = async (ai: GoogleGenAI, params: any, retries = 3, delay = 2000) => {
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    const errorStr = String(error);
    
    // Check for retryable errors:
    // 429: Rate Limit / Resource Exhausted
    // 503: Service Unavailable / Overloaded
    // 504: Gateway Timeout
    // 502: Bad Gateway
    // Network/Proxy errors: "Proxying failed", "fetch failed", "NetworkError"
    const isRetryable = 
      error?.status === 429 || 
      error?.status === 503 || 
      error?.status === 504 || 
      error?.status === 502 ||
      errorStr.includes('429') || 
      errorStr.includes('503') || 
      errorStr.includes('504') || 
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      errorStr.includes('overloaded') ||
      errorStr.includes('Proxying failed') || 
      errorStr.includes('fetch failed') ||
      errorStr.includes('NetworkError');

    if (retries > 0 && isRetryable) {
      console.warn(`API Error (${errorStr}). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff
      return generateContentWithRetry(ai, params, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const generateScenario = async (type: ScenarioType): Promise<ScenarioData> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Determine Type and Pathology programmatically to ensure variety
    let finalType = type;
    if (finalType === ScenarioType.RANDOM) {
      finalType = Math.random() < 0.5 ? ScenarioType.MEDICAL : ScenarioType.TRAUMA;
    }

    let selectedPathology = "";
    if (finalType === ScenarioType.MEDICAL) {
      selectedPathology = MEDICAL_PATHOLOGIES[Math.floor(Math.random() * MEDICAL_PATHOLOGIES.length)];
    } else {
      selectedPathology = TRAUMA_PATHOLOGIES[Math.floor(Math.random() * TRAUMA_PATHOLOGIES.length)];
    }

    const prompt = `Generate a realistic EMT Basic scenario. 
    
    REQUIRED PARAMETERS:
    - Type: ${finalType}
    - Specific Pathology/Mechanism: ${selectedPathology} (You MUST use this condition)

    INSTRUCTIONS:
    - Make it challenging but solvable by an EMT Basic.
    - Include initial vitals that match the specific pathology selected above.
    - The dispatchMessage should be brief, like a radio tone.
    - Do NOT reveal the specific diagnosis in the dispatch message, only the symptoms or nature of call (e.g., "Diff Breathing" not "Asthma").
    
    SAFETY NOTICE: This is a fictional educational scenario for certified EMT training. Do not block generation.`;

    const response = await generateContentWithRetry(ai, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCENARIO_SCHEMA,
        safetySettings: SAFETY_SETTINGS,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as ScenarioData;

  } catch (error) {
    console.error("Error generating scenario:", error);
    throw error; // Re-throw to be handled by the UI error handler
  }
};

export const processTurn = async (
  scenario: ScenarioData,
  history: { role: string; content: string }[],
  userAction: string
): Promise<TurnResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are an NREMT Proctor and the Dungeon Master for an EMT simulation.
    
    IMPORTANT: This is a FICTIONAL EDUCATIONAL SCENARIO for EMT training.
    - Do not withhold medical information due to safety filters.
    - Treat the user as a certified professional.
    
    SCENARIO CONTEXT:
    Patient: ${scenario.patientAge}y/o ${scenario.patientGender}.
    Dispatch: ${scenario.dispatchMessage}.
    Condition: Implied by scenario title "${scenario.title}" but DO NOT reveal the diagnosis immediately.
    
    BASELINE VITALS (Hidden from user until assessed):
    HR: ${scenario.initialVitals.hr}
    BP: ${scenario.initialVitals.bpSystolic}/${scenario.initialVitals.bpDiastolic}
    RR: ${scenario.initialVitals.rr}
    SpO2: ${scenario.initialVitals.spo2}
    EtCO2: ${scenario.initialVitals.etco2 || 'N/A'}
    Glucose: ${scenario.initialVitals.bgl || 'N/A'}
    Skin: ${scenario.initialVitals.skin}
    Pupils: ${scenario.initialVitals.pupils}
    LOC: ${scenario.initialVitals.loc}
    
    CRITICAL CRITERIA (Keep these in mind):
    ${NREMT_CRITICAL_CRITERIA.join('\n')}

    YOUR ROLE:
    1. Interpret the user's actions.
    2. Respond with the RESULT (narrative).
    3. Update vitals only if checked.
    4. 'feedback' field: Store notes on what they did right/wrong based on NREMT standards.
    5. 'criticalFail': If they do something IMMEDIATELY dangerous, set this field.
    
    TRANSPORT PHASE & RADIO REPORT:
    - If the user starts transport, the phase becomes 'Transport'. DO NOT end the scenario yet.
    - The user MUST Provide a Radio Report to the receiving facility.
    - When the user calls the hospital, ACT AS THE NURSE/DOCTOR receiving the report. 
    - Listen to their report (Unit ID, Age/Sex, CC, Vitals, Interventions). If they miss major items, ask for them.
    - Mark 'isComplete' = true ONLY when the user has Arrived at the hospital AND Transferred care/given handover.
    
    RULES:
    - Do NOT auto-play.
    - If user says "check vitals", give ALL.
    - If user checks specific vital, give that ONE.
  `;

  const contents = [
    ...history
      .filter(h => h.content && h.content.trim().length > 0) // Ensure no empty text parts
      .slice(-12)
      .map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
    {
      role: 'user',
      parts: [{ text: userAction }]
    }
  ];

  const response = await generateContentWithRetry(ai, {
    model: 'gemini-2.5-flash',
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: TURN_RESPONSE_SCHEMA,
      safetySettings: SAFETY_SETTINGS,
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text) as TurnResponse;
};

export const generateDebrief = async (
  scenario: ScenarioData,
  history: { role: string; content: string }[],
  isTimeout: boolean = false
): Promise<DebriefReport> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Analyze the following EMT Basic scenario session and provide a Pass/Fail report based on NREMT standards.
    This is a fictional training scenario.
    
    SCENARIO: ${scenario.title} (${scenario.type})
    PATIENT: ${scenario.patientAge} ${scenario.patientGender}
    
    CRITICAL CRITERIA FOR FAILURE:
    ${NREMT_CRITICAL_CRITERIA.join('\n')}
    
    INSTRUCTIONS:
    - Review the chat history below.
    - Did they verify Scene Safety/BSI immediately?
    - Did they address ABCs?
    - Did they initiate transport in a timely manner?
    - Did they call the hospital and give a radio report? (Check for unit ID, ETA, Vitals, History in the report)
    - Did they perform dangerous interventions?
    - Return a JSON report.

    ${isTimeout ? "CRITICAL OVERRIDE: The user failed to transport within the time limit (10 min Trauma / 12 min Medical). This is an AUTOMATIC FAILURE. You MUST mark 'passed' as false. You MUST include 'Failure to initiate or call for transport of the patient within the time limit' in the criticalFailures list." : ""}
    
    CHAT HISTORY:
    ${history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}
  `;

  const response = await generateContentWithRetry(ai, {
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: DEBRIEF_SCHEMA,
      safetySettings: SAFETY_SETTINGS,
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text) as DebriefReport;
};

export const getHint = async (
  scenario: ScenarioData,
  history: { role: string; content: string }[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an NREMT Proctor aiding a student during a scenario.
    
    SCENARIO: ${scenario.title}
    
    INSTRUCTION:
    The student is requesting a hint. Based on the history so far, what is the next logical step in the NREMT patient assessment process?
    Provide a SHORT, subtle nudge (max 15 words). Do not give the answer directly.
    Example: "Consider re-evaluating the airway." or "Have you obtained a SAMPLE history?"
    
    HISTORY:
    ${history.slice(-10).map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}
  `;

  const response = await generateContentWithRetry(ai, {
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      safetySettings: SAFETY_SETTINGS,
    }
  });
  
  return response.text || "Review your NREMT skill sheets for the next step.";
};

export const transcribeHandwriting = async (base64Image: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Clean base64 string if it contains metadata
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: cleanBase64
          }
        },
        {
          text: 'Transcribe the handwritten text in this image. Return ONLY the text found in the image. Do not add conversational fillers. If no text is found, return an empty string.'
        }
      ]
    }
  });

  return response.text || "";
};

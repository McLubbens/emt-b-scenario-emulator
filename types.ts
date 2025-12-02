
export enum ScenarioType {
  MEDICAL = 'MEDICAL',
  TRAUMA = 'TRAUMA',
  RANDOM = 'RANDOM'
}

export enum GameState {
  LOBBY = 'LOBBY',
  DISPATCH = 'DISPATCH',
  ACTIVE = 'ACTIVE',
  TRANSPORT = 'TRANSPORT', // New state for en route
  EVALUATING = 'EVALUATING', // New state for generating the report
  DEBRIEF = 'DEBRIEF'
}

export interface Vitals {
  hr?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  rr?: number;
  spo2?: number;
  etco2?: number;
  bgl?: number; // Blood Glucose
  temp?: number;
  skin?: string; // e.g., "Pale, cool, diaphoretic"
  pupils?: string; // e.g., "PERRL"
  loc?: string; // AVPU or GCS
}

export interface ScenarioData {
  title: string;
  dispatchMessage: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  type: ScenarioType;
  initialVitals: Vitals;
  environment: string;
  patientGender: string;
  patientAge: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isFeedback?: boolean; // If true, it's meta-commentary on the user's performance
}

export interface TurnResponse {
  narrative: string;
  updatedVitals?: Partial<Vitals>;
  feedback?: string; // Hidden feedback or immediate correction
  phase: string; // e.g., "Primary Assessment", "History"
  criticalFail?: string; // If the user performed a dangerous action, describe it here.
  isComplete: boolean;
}

export interface DebriefReport {
  passed: boolean;
  score: number; // 0-100
  criticalFailures: string[]; // List of specific NREMT criteria violated
  feedbackSummary: string; // General summary of performance
  clinicalReasoning: string; // Why they passed or failed
}

export const NREMT_CRITICAL_CRITERIA = [
  "Failure to initiate or call for transport of the patient within the 10 min. (trauma) or 12 min. (medical) time limit.",
  "Failure to take or verbalize appropriate PPE precautions.",
  "Failure to determine scene safety.",
  "Failure to assess for and provide spinal protection when indicated.",
  "Failure to voice (required) and ultimately provide (dependant on patient status) oxygen.",
  "Failure to assess/provide adequate ventilation.",
  "Failure to find or appropriately manage problems asociated with airway, breathing, hemorrhage or shock.",
  "Failure to differentiate patient's need for immediate transportation versus continued assessment/treatment at the scene.",
  "Failure to determine the patient's primary problem.",
  "Performs other assessments before assessing/treating threats to airway, breathing and circulation.",
  "Failure to manage the patient as a competent EMT.",
  "Exhibits unacceptable affect with patient or other personnel.",
  "Uses or orders a dangerous or inappropriate intervention."
];

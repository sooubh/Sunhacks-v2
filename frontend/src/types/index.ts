// ─── Core OSINT Types ───────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Sentiment = 'PANIC' | 'AGGRESSION' | 'NEUTRAL' | 'TENSE';
export type EventCategory = 'PROTEST' | 'VIOLENCE' | 'UNREST' | 'ACCIDENT' | 'SURVEILLANCE' | 'UNKNOWN';
export type AlertStatus = 'ACTIVE' | 'RESOLVED' | 'MONITORING';
export type FilterType = 'ALL' | 'ACTIVE' | 'HIGH' | 'RESOLVED';

export interface OSINTSource {
  id: string;
  name: string;
  type: 'NEWS_API' | 'RSS' | 'WEB_SEARCH' | 'SOCIAL';
  url: string;
  fetchedAt: Date;
}

export interface Entity {
  name: string;
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'EVENT';
}

export interface EvidenceItem {
  source: string;
  url: string;
  excerpt: string;
  fetchedAt: string;
}

export interface Alert {
  id: string;
  title: string;
  summary: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  timestamp: Date;
  riskLevel: RiskLevel;
  confidence: number; // 0-100
  escalationProbability: number; // 0-100
  sentiment: Sentiment;
  category: EventCategory;
  status: AlertStatus;
  entities: Entity[];
  keywords: string[];
  evidence: EvidenceItem[];
  whyTriggered: string;
  recommendedActions: string[];
  sources: OSINTSource[];
  rawCount: number; // how many raw articles merged
  sourceValidity?: 'VERIFIED' | 'MIXED' | 'UNVERIFIED';
  impact?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStage {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: 'IDLE' | 'RUNNING' | 'DONE' | 'ERROR';
  itemsProcessed: number;
  processingTime: number; // ms
  lastRun: Date | null;
}

export interface AuditLog {
  id: string;
  alertId: string;
  action: string;
  performedBy: string;
  timestamp: Date;
  details: string;
  beforeState?: string;
  afterState?: string;
}

export interface DashboardStats {
  totalAlerts: number;
  activeAlerts: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  resolvedToday: number;
  avgConfidence: number;
  topLocation: string;
  lastUpdated: Date;
}

export interface RiskTrend {
  time: string;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'ANALYST' | 'COMMANDER' | 'ADMIN';
  department: string;
  lastLogin: Date;
}

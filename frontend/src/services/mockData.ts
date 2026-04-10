import type { Alert, AuditLog, Entity, EvidenceItem, EventCategory, OSINTSource, PipelineStage, RiskLevel, Sentiment } from '../types';
import { format, subHours, subMinutes } from 'date-fns';

// ─── Static Data Pools ───────────────────────────────────────────────────────

const LOCATIONS = [
  'Mumbai, Maharashtra',
  'Delhi, Delhi',
  'Bangalore, Karnataka',
  'Hyderabad, Telangana',
  'Chennai, Tamil Nadu',
];

const EVENTS: { title: string; category: EventCategory; keywords: string[]; sentiment: Sentiment }[] = [
  {
    title: 'Large-Scale Protest at Central Secretariat Over Land Acquisition',
    category: 'PROTEST',
    keywords: ['protest', 'land acquisition', 'farmers', 'blockade', 'demonstration'],
    sentiment: 'TENSE',
  },
  {
    title: 'Communal Tension Reported After Procession Clash',
    category: 'VIOLENCE',
    keywords: ['communal', 'clash', 'procession', 'tension', 'curfew'],
    sentiment: 'AGGRESSION',
  },
  {
    title: 'University Students Block Highway Demanding Fee Rollback',
    category: 'UNREST',
    keywords: ['students', 'highway block', 'fee hike', 'agitation', 'education'],
    sentiment: 'TENSE',
  },
  {
    title: 'Multi-Vehicle Accident on National Highway Causes Traffic Snarl',
    category: 'ACCIDENT',
    keywords: ['accident', 'highway', 'traffic', 'casualties', 'emergency'],
    sentiment: 'NEUTRAL',
  },
  {
    title: 'Workers Strike at Industrial Zone Turns Violent',
    category: 'VIOLENCE',
    keywords: ['strike', 'workers', 'industrial', 'police', 'violence', 'union'],
    sentiment: 'AGGRESSION',
  },
  {
    title: 'Farmers March Toward State Capital Creating Disruption',
    category: 'PROTEST',
    keywords: ['farmers', 'march', 'capital', 'MSP', 'agriculture', 'police deployment'],
    sentiment: 'PANIC',
  },
  {
    title: 'Suspected Arson at Market District Under Investigation',
    category: 'VIOLENCE',
    keywords: ['arson', 'fire', 'market', 'investigation', 'suspects'],
    sentiment: 'AGGRESSION',
  },
  {
    title: 'Political Rally Leads to Road Blockade in District',
    category: 'UNREST',
    keywords: ['rally', 'political', 'road block', 'election', 'crowd'],
    sentiment: 'TENSE',
  },
  {
    title: 'Flash Flood Triggers Panic in Low-Lying Areas',
    category: 'ACCIDENT',
    keywords: ['flood', 'natural disaster', 'evacuation', 'relief', 'NDRF'],
    sentiment: 'PANIC',
  },
  {
    title: 'Inter-Community Dispute Escalates at Local Market',
    category: 'UNREST',
    keywords: ['dispute', 'community', 'market', 'police', 'peace talks'],
    sentiment: 'TENSE',
  },
];

const RISK_LEVELS: RiskLevel[] = ['HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'LOW', 'LOW'];

const SOURCES: OSINTSource[] = [
  { id: 's1', name: 'NewsData.io', type: 'NEWS_API', url: 'https://newsdata.io', fetchedAt: new Date() },
  { id: 's2', name: 'GNews API', type: 'NEWS_API', url: 'https://gnews.io', fetchedAt: new Date() },
  { id: 's3', name: 'Times of India RSS', type: 'RSS', url: 'https://toi.com/rss', fetchedAt: new Date() },
  { id: 's4', name: 'Tavily Web Search', type: 'WEB_SEARCH', url: 'https://tavily.com', fetchedAt: new Date() },
  { id: 's5', name: 'NDTV RSS Feed', type: 'RSS', url: 'https://ndtv.com/rss', fetchedAt: new Date() },
  { id: 's6', name: 'The Hindu RSS', type: 'RSS', url: 'https://thehindu.com/rss', fetchedAt: new Date() },
];

const WHY_TEMPLATES = [
  'Multiple independent sources corroborated the incident within a 2-hour window. Keyword density for "{kw}" exceeded threshold (score: {score}). NER identified {count} unique locations and {orgs} government entities.',
  'Sentiment analysis returned AGGRESSION class with {score}% confidence. Event matched the VIOLENCE category pattern. Escalation model flagged based on historical incidents in this region.',
  'Cross-referenced with {count} prior incidents in the same district over 30 days. Protest keywords matched rule-set R-7. Crowd size estimation from satellite feed indicates 500+ participants.',
  'Pattern match triggered on "{kw}" cluster. Temporal proximity to scheduled political event increases risk weighting by +18 points. Similar incidents in neighboring districts logged in last 48h.',
];

const ACTIONS_BY_RISK: Record<RiskLevel, string[]> = {
  HIGH: [
    'Immediately deploy rapid response unit to the area.',
    'Issue advisory to district magistrate and state police chief.',
    'Activate Section 144 if crowd size exceeds 500.',
    'Coordinate with NDRF and medical teams for standby.',
    'Establish real-time communication channel with local SP.',
  ],
  MEDIUM: [
    'Increase patrolling in the affected district.',
    'Notify local police station and district administration.',
    'Monitor social media channels for escalation signals.',
    'Prepare quick reaction team for possible rapid deployment.',
  ],
  LOW: [
    'Log event for historical trend analysis.',
    'Issue situational awareness bulletin to local officers.',
    'Continue routine monitoring of the area.',
  ],
};

// ─── Generators ──────────────────────────────────────────────────────────────

let alertIdCounter = 1000;

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEntities(location: string): Entity[] {
  return [
    { name: location.split(',')[0], type: 'LOCATION' },
    { name: randomItem(['State Police', 'District Administration', 'Municipal Corporation', 'NDRF', 'Central Reserve Police']), type: 'ORGANIZATION' },
    { name: randomItem(['District Collector', 'SP Office', 'DIG', 'Chief Minister Office', 'Home Ministry']), type: 'ORGANIZATION' },
  ];
}

function generateEvidence(event: typeof EVENTS[0], location: string): EvidenceItem[] {
  const sourcePairs = [
    { source: 'Times of India', url: 'https://toi.com/news/article-123', excerpt: `Tensions escalated in ${location} as crowds gathered near the main junction.` },
    { source: 'NDTV', url: 'https://ndtv.com/india/article-456', excerpt: `Officials confirmed the situation is being monitored. Police deployed in ${location}.` },
    { source: 'The Hindu', url: 'https://thehindu.com/news/article-789', excerpt: `${event.keywords[0]} reported. Eyewitnesses describe chaotic scenes near the area.` },
    { source: 'Tavily Web Search', url: 'https://search.tavily.com/result-321', excerpt: `Multiple social media posts confirm ${event.keywords[1]} activity in the region.` },
  ];
  return sourcePairs.slice(0, 2 + Math.floor(Math.random() * 2)).map(e => ({ ...e, fetchedAt: format(new Date(), 'yyyy-MM-dd HH:mm') }));
}

function generateWhyText(event: typeof EVENTS[0]): string {
  const template = randomItem(WHY_TEMPLATES);
  return template
    .replace('{kw}', event.keywords[0])
    .replace('{score}', String(Math.floor(Math.random() * 15) + 80))
    .replace('{count}', String(Math.floor(Math.random() * 4) + 2))
    .replace('{orgs}', String(Math.floor(Math.random() * 3) + 1));
}

export function generateMockAlerts(count: number): Alert[] {
  const alerts: Alert[] = [];
  for (let i = 0; i < count; i++) {
    const event = randomItem(EVENTS);
    const location = randomItem(LOCATIONS);
    const risk = randomItem(RISK_LEVELS);
    const hoursAgo = Math.floor(Math.random() * 72);
    const createdAt = subHours(new Date(), hoursAgo);

    alerts.push({
      id: `ALT-${++alertIdCounter}`,
      title: event.title,
      summary: `Intelligence indicates ${event.keywords[0]} activity in ${location}. Multiple sources confirm escalating situation requiring immediate assessment.`,
      location,
      timestamp: createdAt,
      riskLevel: risk,
      confidence: Math.floor(Math.random() * 25) + (risk === 'HIGH' ? 75 : risk === 'MEDIUM' ? 55 : 40),
      escalationProbability: risk === 'HIGH' ? Math.floor(Math.random() * 20) + 70 : risk === 'MEDIUM' ? Math.floor(Math.random() * 30) + 35 : Math.floor(Math.random() * 25) + 10,
      sentiment: event.sentiment,
      category: event.category,
      status: Math.random() > 0.3 ? 'ACTIVE' : 'RESOLVED',
      entities: generateEntities(location),
      keywords: event.keywords,
      evidence: generateEvidence(event, location),
      whyTriggered: generateWhyText(event),
      recommendedActions: ACTIONS_BY_RISK[risk].slice(0, Math.floor(Math.random() * 2) + 2),
      sources: SOURCES.slice(0, Math.floor(Math.random() * 3) + 2),
      rawCount: Math.floor(Math.random() * 12) + 3,
      createdAt,
      updatedAt: subMinutes(new Date(), Math.floor(Math.random() * 60)),
    });
  }
  return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function generateMockAuditLogs(alerts: Alert[]): AuditLog[] {
  const actions = ['ALERT_CREATED', 'STATUS_CHANGED', 'ALERT_REVIEWED', 'ACTION_TAKEN', 'ESCALATED', 'RESOLVED'];
  const users = ['analyst.sharma@gov.in', 'cmd.verma@gov.in', 'admin.singh@gov.in'];
  const logs: AuditLog[] = [];

  alerts.slice(0, 20).forEach((alert, i) => {
    const count = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < count; j++) {
      logs.push({
        id: `LOG-${i * 10 + j}`,
        alertId: alert.id,
        action: randomItem(actions),
        performedBy: randomItem(users),
        timestamp: subHours(new Date(), Math.floor(Math.random() * 48)),
        details: `${randomItem(actions)} for alert ${alert.id} in ${alert.location}`,
        beforeState: j === 0 ? undefined : 'ACTIVE',
        afterState: j === 0 ? 'ACTIVE' : 'RESOLVED',
      });
    }
  });

  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function generateMockPipelineStages(): PipelineStage[] {
  return [
    { id: 'collector', name: 'OSINT Collector', icon: '📡', description: 'Fetches data from News APIs, RSS feeds, and web search in parallel', status: 'DONE', itemsProcessed: 148, processingTime: 1240, lastRun: subMinutes(new Date(), 3) },
    { id: 'cleaner', name: 'Data Cleaner', icon: '🧹', description: 'Removes duplicates via hash + semantic similarity, merges related events', status: 'DONE', itemsProcessed: 112, processingTime: 380, lastRun: subMinutes(new Date(), 2) },
    { id: 'analyzer', name: 'AI Analyzer', icon: '🔍', description: 'Extracts entities, performs NER, sentiment analysis, and classification', status: 'DONE', itemsProcessed: 98, processingTime: 820, lastRun: subMinutes(new Date(), 2) },
    { id: 'predictor', name: 'Risk Predictor', icon: '⚠️', description: 'Assigns risk levels, confidence scores, and escalation probability', status: 'DONE', itemsProcessed: 98, processingTime: 290, lastRun: subMinutes(new Date(), 1) },
    { id: 'reporter', name: 'Report Generator', icon: '📄', description: 'Creates explainable summaries, evidence chains, and recommended actions', status: 'DONE', itemsProcessed: 98, processingTime: 410, lastRun: subMinutes(new Date(), 1) },
  ];
}

export function getRiskTrends() {
  const data = [];
  for (let i = 23; i >= 0; i--) {
    const hour = format(subHours(new Date(), i), 'HH:mm');
    data.push({ time: hour, HIGH: Math.floor(Math.random() * 5) + 1, MEDIUM: Math.floor(Math.random() * 8) + 2, LOW: Math.floor(Math.random() * 6) + 3 });
  }
  return data;
}

export function getCategoryDistribution(alerts: Alert[]) {
  const map: Record<string, number> = {};
  alerts.forEach(a => { map[a.category] = (map[a.category] || 0) + 1; });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

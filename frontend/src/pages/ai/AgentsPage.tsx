import React from 'react';
import { Brain, Search, TrendingUp, AlertTriangle, FileText, Database, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AgentType } from '../../types';

const AGENTS: Array<{
  type: AgentType; name: string; description: string;
  capabilities: string[]; icon: React.ElementType; color: string;
}> = [
  { type: 'master', name: 'Master Intelligence Agent', icon: Brain, color: 'from-violet-500 to-purple-600',
    description: 'Orchestrates all agents, understands intent, decomposes tasks, validates and synthesizes results.',
    capabilities: ['Query Understanding', 'Intent Detection', 'Task Decomposition', 'Agent Selection', 'Evidence Fusion', 'Response Verification'] },
  { type: 'rag', name: 'RAG Agent', icon: Search, color: 'from-blue-500 to-cyan-500',
    description: 'Retrieves relevant information from the document knowledge base using hybrid vector + keyword search.',
    capabilities: ['Vector Search', 'Keyword Search', 'Hybrid Retrieval', 'Relevance Scoring', 'Citation Extraction'] },
  { type: 'analytics', name: 'Analytics Agent', icon: TrendingUp, color: 'from-green-500 to-emerald-500',
    description: 'Performs statistical analysis, trend detection, and anomaly identification on business metrics.',
    capabilities: ['Trend Analysis', 'Statistical Analysis', 'Anomaly Detection', 'Forecasting', 'KPI Computation'] },
  { type: 'sales', name: 'Sales Agent', icon: TrendingUp, color: 'from-amber-500 to-orange-500',
    description: 'Analyzes sales data, pipeline health, win/loss rates, and regional performance.',
    capabilities: ['Pipeline Analysis', 'Revenue Attribution', 'Win/Loss Analysis', 'Regional Performance', 'Sales Forecasting'] },
  { type: 'customer_intelligence', name: 'Customer Intelligence Agent', icon: Users, color: 'from-pink-500 to-rose-500',
    description: 'Analyzes customer behavior, churn risk, lifetime value, and satisfaction metrics.',
    capabilities: ['Churn Prediction', 'CLV Analysis', 'Segmentation', 'Satisfaction Scoring', 'Risk Scoring'] },
  { type: 'finance', name: 'Finance Agent', icon: Database, color: 'from-teal-500 to-cyan-600',
    description: 'Handles financial data including P&L, budgets, costs, and financial risk assessment.',
    capabilities: ['P&L Analysis', 'Budget Tracking', 'Cost Analysis', 'Financial Risk', 'Revenue Attribution'] },
  { type: 'risk', name: 'Risk Agent', icon: AlertTriangle, color: 'from-red-500 to-orange-500',
    description: 'Identifies, assesses, and prioritizes enterprise risks across all business domains.',
    capabilities: ['Risk Identification', 'Impact Assessment', 'Probability Scoring', 'Mitigation Planning', 'Risk Monitoring'] },
  { type: 'document_intelligence', name: 'Document Intelligence Agent', icon: FileText, color: 'from-indigo-500 to-blue-600',
    description: 'Deep document analysis, extraction, comparison, and summarization.',
    capabilities: ['Document Summarization', 'Entity Extraction', 'Comparison Analysis', 'Key Clause Detection', 'Insight Extraction'] },
  { type: 'data_intelligence', name: 'Data Intelligence Agent', icon: Database, color: 'from-cyan-500 to-blue-500',
    description: 'Queries and analyzes structured business data from MongoDB collections.',
    capabilities: ['Data Querying', 'Pattern Recognition', 'Data Quality', 'Outlier Detection', 'Business Metrics'] },
  { type: 'executive', name: 'Executive Agent', icon: Brain, color: 'from-purple-500 to-violet-600',
    description: 'Synthesizes board-ready summaries and strategic insights for executive decision-making.',
    capabilities: ['Executive Summarization', 'Strategic Insights', 'Board Reporting', 'Decision Support', 'Impact Analysis'] },
  { type: 'data_query', name: 'Data Query Agent', icon: Database, color: 'from-slate-500 to-gray-600',
    description: 'Translates natural language into MongoDB queries and retrieves structured business data.',
    capabilities: ['NL to MongoDB Query', 'Data Retrieval', 'Aggregation Pipelines', 'Cross-collection Joins', 'Data Filtering'] },
  { type: 'knowledge_graph', name: 'Knowledge Graph Agent', icon: Database, color: 'from-blue-600 to-indigo-700',
    description: 'Queries the Enterprise Knowledge Graph to find connections and relationships between entities.',
    capabilities: ['Entity Extraction', 'Relationship Mapping', 'Cross-department Linking', 'Path Discovery', 'Graph-based Reasoning'] },
  ];

export default function AgentsPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">AI Agents</h1>
          <p className="text-xs text-muted-foreground">
            11 specialized agents collaborate — the Master Agent orchestrates them all.
          </p>
        </div>
        <button
          onClick={() => navigate('/reports', { state: { dashboardType: 'AI Agents', filters: {}, metrics: {} } })}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <FileText className="w-3.5 h-3.5" /> Generate Agent Report
        </button>
      </div>

      {/* Master Agent highlight */}
      <div className="glass rounded-2xl p-6 card-glow mb-8 border border-violet-500/20 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-foreground">Master Intelligence Agent</h2>
              <span className="agent-badge text-violet-400 border-violet-500/30 bg-violet-500/10">Orchestrator</span>
            </div>
            <p className="text-muted-foreground mb-4">
              The central coordinator that understands your query, breaks it into subtasks, selects the right agents,
              validates their results, fuses evidence, and generates final responses with citations and confidence scores.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['Query Understanding', 'Intent Detection', 'Task Decomposition', 'Agent Selection', 'Result Validation', 'Evidence Fusion'].map((cap) => (
                <div key={cap} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  <span className="text-muted-foreground">{cap}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Specialized Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
        {AGENTS.filter((a) => a.type !== 'master').map((agent) => (
          <div key={agent.type} className="glass rounded-2xl p-5 card-glow hover:glass-hover transition-all duration-200">
            <div className="flex items-start gap-3 mb-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${agent.color} flex-shrink-0`}>
                <agent.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{agent.name}</h3>
                <span className="text-xs text-muted-foreground capitalize">{agent.type.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{agent.description}</p>
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.slice(0, 4).map((cap) => (
                <span key={cap} className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">{cap}</span>
              ))}
              {agent.capabilities.length > 4 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">+{agent.capabilities.length - 4} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { AlertTriangle, BookOpen, Brain, CheckCircle2, Lightbulb, MessageSquare, Scale, ShieldCheck, Target } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { DecisionEvaluationResult } from '../api';

function rewardTone(ratio: string) {
  if (ratio === 'High') return 'success' as const;
  if (ratio === 'Medium') return 'warning' as const;
  return 'destructive' as const;
}

export function EvaluationResultView({
  result,
  context,
  onReport,
  onChat,
}: {
  result: DecisionEvaluationResult;
  context: { department: string; budget: string; riskTolerance: string; decisionText: string };
  onReport: () => void;
  onChat: () => void;
}) {
  return (
    <div className="animate-fade-in-up space-y-4">
      {/* Report header */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">Simulation report</h3>
            <p className="text-[11px] text-muted-foreground">{context.department} · {context.budget} · {context.riskTolerance} risk</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={rewardTone(result.rewardRatio)}>Reward ratio: {result.rewardRatio}</Badge>
            <Button size="sm" variant="outline" onClick={onChat}>
              <MessageSquare className="h-3.5 w-3.5" /> Analyze
            </Button>
            <Button size="sm" variant="outline" onClick={onReport}>
              <BookOpen className="h-3.5 w-3.5" /> Generate report
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] text-muted-foreground">Confidence</span>
          <div className="h-1.5 w-36 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn('h-full rounded-full transition-all duration-700', result.confidence >= 0.6 ? 'bg-success' : 'bg-warning')}
              style={{ width: `${Math.round(result.confidence * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono tabular text-foreground">{Math.round(result.confidence * 100)}%</span>
        </div>
      </div>

      {/* Strategic overview */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Brain className="h-3.5 w-3.5 text-primary" /> Strategic overview
        </p>
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-secondary-foreground">{result.summary}</p>
      </div>

      {/* Opportunities / Risks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-success">
            <Target className="h-3.5 w-3.5" /> Opportunities
          </p>
          <ul className="space-y-2.5">
            {result.opportunities.map((opp, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span className="text-secondary-foreground">{opp}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Risks
          </p>
          <ul className="space-y-2.5">
            {result.risks.map((risk, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span className="text-secondary-foreground">{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Operational impact */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Scale className="h-3.5 w-3.5 text-primary" /> Estimated operational impact
        </p>
        <p className="text-[13.5px] leading-relaxed text-secondary-foreground">{result.expectedImpact}</p>
      </div>

      {/* Recommendation */}
      <div className="rounded-xl border-l-2 border-primary bg-primary/10 px-4 py-3.5">
        <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
          <Lightbulb className="h-3.5 w-3.5" /> Recommendation
        </p>
        <p className="text-[13.5px] font-medium leading-relaxed text-foreground">{result.recommendation}</p>
      </div>
    </div>
  );
}
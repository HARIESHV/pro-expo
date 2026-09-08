import { RiskSeverity } from './types';

/**
 * Deterministic, non-random risk scoring utilities.
 * riskScore = probability * impact / 100  (probability & impact in 0-100)
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calcRiskScore(probability: number, impact: number): number {
  const p = clamp(probability, 0, 100);
  const i = clamp(impact, 0, 100);
  return Math.round((p * i) / 100);
}

export function severityFromScore(score: number): RiskSeverity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Aggregate confidence from multiple independent confirmations.
 * Confidence rises with the number of supporting signals but saturates, so a
 * single weak signal can't claim high confidence. Confidence is independent of
 * severity — a high-impact but weakly-supported risk keeps low confidence.
 */
export function aggregateConfidence(confidences: number[], maxSignals = 6): number {
  if (confidences.length === 0) return 0;
  const base = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const boost = Math.min(confidences.length - 1, maxSignals - 1) * 0.06;
  return clamp(Math.round((base + boost) * 100) / 100, 0, 1);
}

/**
 * Map a probability percentage/half to a deterministic confidence estimate
 * used when only a single source is available.
 */
export function confidenceFromProbability(probability: number): number {
  return clamp(Math.round(clamp(probability, 0, 100) / 100 * 0.85 * 100) / 100, 0, 1);
}

export function describeSeverity(severity: RiskSeverity): string {
  switch (severity) {
    case 'critical': return 'Critical';
    case 'high': return 'High';
    case 'medium': return 'Moderate';
    default: return 'Low';
  }
}

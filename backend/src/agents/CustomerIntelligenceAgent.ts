import { AgentResult, QueryUnderstanding, Source } from '../types';
import { Customer } from '../models/Customer';
import { SupportTicket } from '../models/SupportTicket';
import { openai, AI_MODEL } from '../config/openai';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

interface CustomerContext {
  organizationId: string;
}

export class CustomerIntelligenceAgent {
  async execute(context: CustomerContext, queryUnderstanding: QueryUnderstanding): Promise<AgentResult> {
    const t0 = Date.now();
    try {
      const orgId = new mongoose.Types.ObjectId(context.organizationId);

      const [customerStats, ticketStats] = await Promise.all([
        Customer.aggregate([
          { $match: { organizationId: orgId } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              avgLTV: { $avg: '$lifetimeValue' },
              avgRiskScore: { $avg: '$riskScore' },
            },
          },
        ]),
        SupportTicket.aggregate([
          { $match: { organizationId: orgId } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              avgResolutionTime: { $avg: '$resolutionTimeHours' },
              avgSatisfaction: { $avg: '$satisfactionRating' },
            },
          },
        ]),
      ]);

      const atRiskCustomers = await Customer.find({
        organizationId: orgId,
        status: 'at_risk',
        riskScore: { $gte: 70 },
      }).select('name region segment lifetimeValue riskScore').limit(10).lean();

      const aiResponse = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a customer intelligence analyst. Analyze customer data and identify key risks, opportunities, and actionable insights.',
          },
          {
            role: 'user',
            content: `Query: ${queryUnderstanding.refinedQuery}\n\nCustomer Stats: ${JSON.stringify(customerStats)}\nAt-Risk Customers: ${JSON.stringify(atRiskCustomers)}\nSupport Stats: ${JSON.stringify(ticketStats)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      const insights = aiResponse.choices[0].message.content?.split('\n').filter(Boolean) || [];

      const sources: Source[] = [
        { id: 'customer-db', title: 'Customer Database', type: 'database', relevanceScore: 0.92 },
        { id: 'support-db', title: 'Support Ticket System', type: 'database', relevanceScore: 0.85 },
      ];

      return {
        agentType: 'customer_intelligence',
        success: true,
        data: { customerStats, atRiskCustomers, ticketStats },
        insights,
        confidence: 0.87,
        sources,
        executionTimeMs: Date.now() - t0,
      };
    } catch (error) {
      logger.error('[CustomerIntelligenceAgent] Failed:', error);
      return {
        agentType: 'customer_intelligence',
        success: false,
        confidence: 0,
        sources: [],
        executionTimeMs: Date.now() - t0,
        error: (error as Error).message,
      };
    }
  }
}

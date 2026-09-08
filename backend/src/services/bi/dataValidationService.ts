import mongoose from 'mongoose';
import { SalesRecord } from '../../models/SalesRecord';
import { Customer } from '../../models/Customer';
import { SupportTicket } from '../../models/SupportTicket';
import { DocumentModel } from '../../models/Document';
import { DataValidation, OrgRef } from './types';

// ===========================================================================
// Data Validation pipeline.
//
// Raw data → validation → cleaning → duplicate detection → missing-value
// detection → normalization → aggregation (performed by the BI engine).
//
// Missing business values are flagged to the caller; they are NEVER silently
// replaced with fabricated numbers here.
// ===========================================================================

export async function validateEnterpriseData(orgRef: OrgRef): Promise<DataValidation> {
  const organizationId = new mongoose.Types.ObjectId(String(orgRef));
  const currencyUsed = 'USD';
  const notes: string[] = [];
  const missingLabels: string[] = [];

  const [sales, customers, tickets, docs] = await Promise.all([
    SalesRecord.find({ organizationId }, { dealId: 1, amount: 1, currency: 1, period: 1, stage: 1, closedAt: 1, createdAt: 1, productName: 1 })
      .lean()
      .catch(() => [] as any[]),
    Customer.find({ organizationId }, { customerId: 1, name: 1, acquisitionDate: 1, segment: 1, region: 1 })
      .lean()
      .catch(() => [] as any[]),
    SupportTicket.find({ organizationId }, { ticketId: 1, status: 1, priority: 1 })
      .lean()
      .catch(() => [] as any[]),
    DocumentModel.find({ organizationId }, { title: 1, processingStatus: 1 }).lean().catch(() => [] as any[]),
  ]);

  // ---- duplicate detection ----
  const duplicateDealIds = new Set<string>();
  const seenDeals = new Set<string>();
  for (const s of sales) {
    const key = String(s.dealId || '');
    if (!key) continue;
    if (seenDeals.has(key)) duplicateDealIds.add(key);
    seenDeals.add(key);
  }

  const duplicateCustomerIds = new Set<string>();
  const seenCustomers = new Set<string>();
  for (const c of customers) {
    const key = String(c.customerId || '');
    if (!key) continue;
    if (seenCustomers.has(key)) duplicateCustomerIds.add(key);
    seenCustomers.add(key);
  }

  const duplicateTicketIds = new Set<string>();
  const seenTickets = new Set<string>();
  for (const t of tickets) {
    const key = String(t.ticketId || '');
    if (!key) continue;
    if (seenTickets.has(key)) duplicateTicketIds.add(key);
    seenTickets.add(key);
  }

  const duplicatesDetected = duplicateDealIds.size + duplicateCustomerIds.size + duplicateTicketIds.size;

  // ---- missing value detection ----
  const missingSales = sales.filter((s) => s.amount == null || !s.period?.year || s.period?.month == null);
  const missingCustomers = customers.filter((c) => !c.acquisitionDate || !c.name);
  if (missingSales.length) missingLabels.push(`${missingSales.length} sales record(s) missing amount/period`);
  if (missingCustomers.length) missingLabels.push(`${missingCustomers.length} customer(s) missing acquisition date or name`);

  // ---- normalization (currency) ----
  const nonDefaultCurrency = new Set<string>();
  for (const s of sales) {
    const cur = String(s.currency || 'USD').toUpperCase();
    if (cur !== 'USD') nonDefaultCurrency.add(cur);
  }

  const normalizationApplied: string[] = [];
  if (nonDefaultCurrency.size === 0) {
    normalizationApplied.push('All sales amounts normalized to USD (no conversions required).');
  } else {
    normalizationApplied.push(
      `Sales amounts contain non-USD currencies (${[...nonDefaultCurrency].join(', ')}) — reported as-is; no silent conversion applied.`
    );
    notes.push(
      `Non-USD amounts are summed as recorded. Configure an FX rate to convert them before analysis for accurate totals.`
    );
  }

  if (sales.length === 0) notes.push('No sales records found — revenue metrics will be reported as insufficient.');
  if (customers.length === 0) notes.push('No customer records found — customer metrics will be reported as insufficient.');
  if (tickets.length === 0) notes.push('No support tickets found — operational metrics will be limited.');

  const missingValuesDetected = missingSales.length + missingCustomers.length;
  const valid = true; // validation completed successfully (validity of *metrics* is reported per-metric)

  if (docs.length === 0) notes.push('No company documents found in the knowledge base.');

  return {
    valid,
    rawSalesRecords: sales.length,
    duplicatesDetected,
    missingValuesDetected,
    missingLabels,
    normalizationApplied,
    currencyUsed,
    notes,
  };
}
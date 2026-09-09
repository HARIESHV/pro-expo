import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Employee } from '../models/Employee';
import { Customer } from '../models/Customer';
import { Project } from '../models/Project';
import { SalesRecord } from '../models/SalesRecord';
import { SupportTicket } from '../models/SupportTicket';
import { Risk } from '../models/Risk';
import { DocumentModel } from '../models/Document';
import { DocumentChunk } from '../models/DocumentChunk';
import { KnowledgeEntity } from '../models/KnowledgeEntity';
import { KnowledgeRelationship } from '../models/KnowledgeRelationship';
import { AuditLog } from '../models/AuditLog';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Company } from '../models/Company';
import { Decision } from '../models/Decision';
import { seedCompanies, syncCompanyIndexes } from '../services/companyDataService';
import { ingestDocument } from '../ingestion/ingestionService';

// Fix Windows SRV lookup
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  // Ignore
}

async function seed() {
  try {
    logger.info('Connecting to database for seeding...');
    mongoose.set('strictQuery', false);
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    logger.info('Connected to MongoDB.');

    // 1. Clean existing records
    logger.info('Cleaning old records...');
    await Promise.all([
      Organization.deleteMany({}),
      User.deleteMany({}),
      Department.deleteMany({}),
      Employee.deleteMany({}),
      Customer.deleteMany({}),
      Project.deleteMany({}),
      SalesRecord.deleteMany({}),
      SupportTicket.deleteMany({}),
      Risk.deleteMany({}),
      DocumentModel.deleteMany({}),
      DocumentChunk.deleteMany({}),
      KnowledgeEntity.deleteMany({}),
      KnowledgeRelationship.deleteMany({}),
      AuditLog.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Company.deleteMany({}),
      Decision.deleteMany({}),
    ]);
    logger.info('Cleaned all collections.');

    const demoOrgId = new mongoose.Types.ObjectId('000000000000000000000001');

    // 2. Create organization
    logger.info('Creating demo organization...');
    const org = await Organization.create({
      _id: demoOrgId,
      name: 'Enterprise Inc',
      slug: 'enterprise-inc',
      description: 'Global corporate entity providing next-generation intelligence solutions.',
      status: 'active',
      subscriptionTier: 'enterprise',
    });
    logger.info(`Organization created: ${org.name}`);

    // 3. Create departments
    logger.info('Creating departments...');
    const deptSales = await Department.create({
      organizationId: org._id,
      name: 'Sales & Revenue Operations',
      code: 'SALES',
      description: 'Manages enterprise pipelines, accounts, and regional sales execution.',
      budget: 1500000,
      headcount: 12,
      location: 'New York HQ',
    });

    const deptCS = await Department.create({
      organizationId: org._id,
      name: 'Customer Success & Support',
      code: 'CS',
      description: 'Dedicated client relationship management and technical operations support.',
      budget: 800000,
      headcount: 8,
      location: 'Austin Hub',
    });

    const deptRD = await Department.create({
      organizationId: org._id,
      name: 'Research & Product Development',
      code: 'RD',
      description: 'Engaged in software engineering, AI architecture, and core research.',
      budget: 2500000,
      headcount: 24,
      location: 'San Francisco Lab',
    });

    const deptHR = await Department.create({
      organizationId: org._id,
      name: 'Human Resources',
      code: 'HR',
      description: 'Talent acquisition, management, and organizational scaling.',
      budget: 400000,
      headcount: 4,
      location: 'New York HQ',
    });

    const deptFinance = await Department.create({
      organizationId: org._id,
      name: 'Finance & Compliance',
      code: 'FINANCE',
      description: 'Oversees financial budgeting, audit trails, and corporate controls.',
      budget: 600000,
      headcount: 5,
      location: 'New York HQ',
    });
    logger.info('Departments created.');

    // 4. Create users
    logger.info('Creating users...');
    const admin = await User.create({
      email: 'admin@company.com',
      password: 'Password123!',
      firstName: 'System',
      lastName: 'Admin',
      displayName: 'System Admin',
      organizationId: org._id,
      departmentId: deptHR._id,
      roles: ['super_admin'],
      status: 'active',
      isEmailVerified: true,
    });

    // Dedicated Admin role for Report Review workflow (spec §1)
    const adminReviewer = await User.create({
      email: 'admin@admin.com',
      password: 'Admin123!',
      firstName: 'Report',
      lastName: 'Admin',
      displayName: 'Report Admin',
      organizationId: org._id,
      departmentId: deptHR._id,
      roles: ['admin'],
      status: 'active',
      isEmailVerified: true,
    });

    const manager = await User.create({
      email: 'manager@company.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      organizationId: org._id,
      departmentId: deptSales._id,
      roles: ['manager', 'ceo'],
      status: 'active',
      isEmailVerified: true,
    });

    const employee = await User.create({
      email: 'employee@company.com',
      password: 'Password123!',
      firstName: 'Alice',
      lastName: 'Johnson',
      displayName: 'Alice Johnson',
      organizationId: org._id,
      departmentId: deptCS._id,
      roles: ['employee'],
      status: 'active',
      isEmailVerified: true,
    });

    const analyst = await User.create({
      email: 'analyst@company.com',
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Smith',
      displayName: 'Bob Smith',
      organizationId: org._id,
      departmentId: deptRD._id,
      roles: ['analyst'],
      status: 'active',
      isEmailVerified: true,
    });

    const finance = await User.create({
      email: 'finance@company.com',
      password: 'Password123!',
      firstName: 'Carol',
      lastName: 'Williams',
      displayName: 'Carol Williams',
      organizationId: org._id,
      departmentId: deptFinance._id,
      roles: ['finance'],
      status: 'active',
      isEmailVerified: true,
    });

    const hr = await User.create({
      email: 'hr@company.com',
      password: 'Password123!',
      firstName: 'David',
      lastName: 'Brown',
      displayName: 'David Brown',
      organizationId: org._id,
      departmentId: deptHR._id,
      roles: ['hr'],
      status: 'active',
      isEmailVerified: true,
    });
    logger.info('Users created.');

    // 5. Create employees
    logger.info('Creating employees...');
    const empCEO = await Employee.create({
      organizationId: org._id,
      employeeId: 'EMP001',
      firstName: 'John',
      lastName: 'Doe',
      email: 'manager@company.com',
      jobTitle: 'Chief Executive Officer',
      departmentId: deptSales._id,
      hireDate: new Date('2022-01-15'),
      employmentType: 'full_time',
      status: 'active',
      location: 'New York HQ',
      performanceScore: 95,
    });

    const empCSManager = await Employee.create({
      organizationId: org._id,
      employeeId: 'EMP002',
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'employee@company.com',
      jobTitle: 'Senior Account Manager',
      departmentId: deptCS._id,
      managerId: empCEO._id,
      hireDate: new Date('2023-04-10'),
      employmentType: 'full_time',
      status: 'active',
      location: 'Austin Hub',
      performanceScore: 90,
    });

    const empRDLead = await Employee.create({
      organizationId: org._id,
      employeeId: 'EMP003',
      firstName: 'Charles',
      lastName: 'Stark',
      email: 'charles.stark@company.com',
      jobTitle: 'R&D Principal Engineer',
      departmentId: deptRD._id,
      managerId: empCEO._id,
      hireDate: new Date('2021-08-20'),
      employmentType: 'full_time',
      status: 'active',
      location: 'San Francisco Lab',
      performanceScore: 98,
    });

    const empCSAgent = await Employee.create({
      organizationId: org._id,
      employeeId: 'EMP004',
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob.smith@company.com',
      jobTitle: 'Support Engineer',
      departmentId: deptCS._id,
      managerId: empCSManager._id,
      hireDate: new Date('2024-02-01'),
      employmentType: 'full_time',
      status: 'active',
      location: 'Austin Hub',
      performanceScore: 85,
    });

    // Update departments headId
    await Department.findByIdAndUpdate(deptSales._id, { headId: empCEO._id });
    await Department.findByIdAndUpdate(deptCS._id, { headId: empCSManager._id });
    await Department.findByIdAndUpdate(deptRD._id, { headId: empRDLead._id });
    logger.info('Employees created.');

    // 6. Create Customers
    logger.info('Creating customers...');
    const custStark = await Customer.create({
      organizationId: org._id,
      customerId: 'CUST-001',
      name: 'Stark Industries',
      email: 'pepper.potts@company.com',
      company: 'Stark Industries',
      industry: 'Defense & Aerospace',
      region: 'West',
      segment: 'enterprise',
      status: 'at_risk',
      lifetimeValue: 250000,
      acquisitionDate: new Date('2023-05-15'),
      lastInteractionDate: new Date('2026-08-20'),
      accountManager: employee._id,
      riskScore: 78,
      satisfactionScore: 5.2,
      tags: ['high_value', 'defense', 'integration_needed'],
    });

    const custWayne = await Customer.create({
      organizationId: org._id,
      customerId: 'CUST-002',
      name: 'Wayne Enterprises',
      email: 'lucius.fox@company.com',
      company: 'Wayne Enterprises',
      industry: 'Technology & Logistics',
      region: 'East',
      segment: 'enterprise',
      status: 'active',
      lifetimeValue: 320000,
      acquisitionDate: new Date('2022-11-01'),
      lastInteractionDate: new Date('2026-08-25'),
      accountManager: employee._id,
      riskScore: 25,
      satisfactionScore: 8.8,
      tags: ['high_value', 'logistics'],
    });

    const custOscorp = await Customer.create({
      organizationId: org._id,
      customerId: 'CUST-003',
      name: 'Oscorp Biotech',
      email: 'norman@company.com',
      company: 'Oscorp Biotech',
      industry: 'Biotechnology',
      region: 'South',
      segment: 'mid_market',
      status: 'active',
      lifetimeValue: 85000,
      acquisitionDate: new Date('2024-03-20'),
      lastInteractionDate: new Date('2026-08-18'),
      accountManager: employee._id,
      riskScore: 40,
      satisfactionScore: 7.2,
    });

    const custLexCorp = await Customer.create({
      organizationId: org._id,
      customerId: 'CUST-004',
      name: 'LexCorp Global',
      email: 'lex@company.com',
      company: 'LexCorp Global',
      industry: 'Conglomerate',
      region: 'North',
      segment: 'enterprise',
      status: 'churned',
      lifetimeValue: 120000,
      acquisitionDate: new Date('2023-01-10'),
      lastInteractionDate: new Date('2025-12-15'),
      accountManager: employee._id,
      riskScore: 100,
      satisfactionScore: 2.0,
      tags: ['competitor_loss'],
    });

    const custPym = await Customer.create({
      organizationId: org._id,
      customerId: 'CUST-005',
      name: 'Pym Technologies',
      email: 'hope@company.com',
      company: 'Pym Technologies',
      industry: 'Nanotechnology',
      region: 'West',
      segment: 'mid_market',
      status: 'active',
      lifetimeValue: 60000,
      acquisitionDate: new Date('2021-06-01'),
      lastInteractionDate: new Date('2026-08-22'),
      accountManager: employee._id,
      riskScore: 15,
      satisfactionScore: 7.9,
      tags: ['long_term'],
    });

    const custKord = await Customer.create({
      organizationId: org._id,
      customerId: 'CUST-006',
      name: 'Kord Industries',
      email: 'ted@company.com',
      company: 'Kord Industries',
      industry: 'Consumer Technology',
      region: 'East',
      segment: 'smb',
      status: 'active',
      lifetimeValue: 45000,
      acquisitionDate: new Date('2022-08-01'),
      lastInteractionDate: new Date('2026-08-10'),
      accountManager: employee._id,
      riskScore: 30,
      satisfactionScore: 6.8,
    });
    logger.info('Customers created.');

    // 7. Create projects
    logger.info('Creating projects...');
    const projX = await Project.create({
      organizationId: org._id,
      name: 'Product X Engine',
      code: 'PROJ-X',
      description: 'Release of next-generation enterprise analytics software kernel.',
      managerId: manager._id,
      departmentId: deptRD._id,
      teamMembers: [admin._id, employee._id],
      status: 'active',
      priority: 'high',
      startDate: new Date('2025-06-01'),
      budget: 800000,
      actualCost: 950000,
      completionPercentage: 85,
      tags: ['software', 'AI', 'delay_risk'],
    });

    const projCSO = await Project.create({
      organizationId: org._id,
      name: 'Stark Industries Integration',
      code: 'PROJ-STARK',
      description: 'Custom ERP and data pipeline integration for Stark Industries.',
      managerId: employee._id,
      departmentId: deptCS._id,
      teamMembers: [admin._id],
      status: 'on_hold',
      priority: 'critical',
      startDate: new Date('2026-02-15'),
      budget: 120000,
      actualCost: 110000,
      completionPercentage: 60,
      tags: ['custom_dev', 'at_risk'],
    });
    logger.info('Projects created.');

    // 8. Create Sales Records (Q1 vs Q2 showing a steep drop)
    logger.info('Creating sales records...');
    // Q1 2026 Sales Records (Total: $520,000)
    await SalesRecord.create([
      {
        organizationId: org._id,
        customerId: custStark._id,
        salesRepId: manager._id,
        departmentId: deptSales._id,
        dealId: 'DEAL-Q1-001',
        productName: 'Cloud Server Suite',
        category: 'Software',
        amount: 150000,
        unitPrice: 150000,
        quantity: 1,
        region: 'West',
        channel: 'direct',
        stage: 'closed_won',
        closedAt: new Date('2026-02-10'),
        probability: 100,
        period: { year: 2026, quarter: 1, month: 2 },
      },
      {
        organizationId: org._id,
        customerId: custWayne._id,
        salesRepId: manager._id,
        departmentId: deptSales._id,
        dealId: 'DEAL-Q1-002',
        productName: 'Cybersecurity Gateway',
        category: 'Security',
        amount: 220000,
        unitPrice: 110000,
        quantity: 2,
        region: 'East',
        channel: 'partner',
        stage: 'closed_won',
        closedAt: new Date('2026-03-05'),
        probability: 100,
        period: { year: 2026, quarter: 1, month: 3 },
      },
      {
        organizationId: org._id,
        customerId: custOscorp._id,
        salesRepId: manager._id,
        departmentId: deptSales._id,
        dealId: 'DEAL-Q1-003',
        productName: 'Data Analytics Core',
        category: 'Analytics',
        amount: 150000,
        unitPrice: 75000,
        quantity: 2,
        region: 'South',
        channel: 'online',
        stage: 'closed_won',
        closedAt: new Date('2026-01-20'),
        probability: 100,
        period: { year: 2026, quarter: 1, month: 1 },
      },
    ]);

    // Q2 2026 Sales Records (Total: $310,000)
    // Drops significantly by 40.3% due to delays and competitive pressures
    await SalesRecord.create([
      {
        organizationId: org._id,
        customerId: custWayne._id,
        salesRepId: manager._id,
        departmentId: deptSales._id,
        dealId: 'DEAL-Q2-001',
        productName: 'Cybersecurity Gateway',
        category: 'Security',
        amount: 120000,
        unitPrice: 120000,
        quantity: 1,
        region: 'East',
        channel: 'partner',
        stage: 'closed_won',
        closedAt: new Date('2026-05-15'),
        probability: 100,
        period: { year: 2026, quarter: 2, month: 5 },
      },
      {
        organizationId: org._id,
        customerId: custOscorp._id,
        salesRepId: manager._id,
        departmentId: deptSales._id,
        dealId: 'DEAL-Q2-002',
        productName: 'Data Analytics Core',
        category: 'Analytics',
        amount: 90000,
        unitPrice: 90000,
        quantity: 1,
        region: 'South',
        channel: 'online',
        stage: 'closed_won',
        closedAt: new Date('2026-04-18'),
        probability: 100,
        period: { year: 2026, quarter: 2, month: 4 },
      },
      {
        organizationId: org._id,
        customerId: custStark._id,
        salesRepId: manager._id,
        departmentId: deptSales._id,
        dealId: 'DEAL-Q2-003',
        productName: 'Cloud Server Suite',
        category: 'Software',
        amount: 100000,
        unitPrice: 100000,
        quantity: 1,
        region: 'West',
        channel: 'direct',
        stage: 'closed_won',
        closedAt: new Date('2026-06-25'),
        probability: 100,
        period: { year: 2026, quarter: 2, month: 6 },
      },
      // Lost deals representing the competitor threats
      {
        organizationId: org._id,
        customerId: custStark._id,
        salesRepId: manager._id,
        departmentId: deptSales._id,
        dealId: 'DEAL-Q2-004',
        productName: 'AI Prediction Module',
        category: 'Software',
        amount: 150000,
        unitPrice: 150000,
        quantity: 1,
        region: 'West',
        channel: 'direct',
        stage: 'closed_lost',
        closedAt: new Date('2026-06-10'),
        probability: 0,
        period: { year: 2026, quarter: 2, month: 6 },
        notes: 'Lost deal to Competitor Y due to delays in releasing Product X engine.',
      },
    ]);

    // Historical sales (2022-2025). Deterministic multi-year revenue history that
    // unlocks long-term / quarterly / YoY analysis in Business Intelligence.
    // Two deterministic closed-won deals per quarter; totals crafted so 2026 sees
    // a realistic YoY slowdown (Q1 -5.5%, Q2 -40.4%) matching the narrative docs.
    const quarterlyTargets: Record<number, number[]> = {
      2022: [220000, 260000, 340000, 380000],
      2023: [300000, 340000, 400000, 460000],
      2024: [400000, 440000, 500000, 560000],
      2025: [550000, 520000, 590000, 640000],
    };
    const historyCustomers = [custPym, custKord, custWayne, custStark, custLexCorp, custOscorp];
    const historyProducts = ['Cloud Server Suite', 'Cybersecurity Gateway', 'Data Analytics Core', 'AI Prediction Module'];
    const historyRegions = ['West', 'East', 'South', 'North'];
    const historyChannels = ['direct', 'partner', 'online'];
    const historySales: any[] = [];
    for (const [yearStr, targets] of Object.entries(quarterlyTargets)) {
      const year = Number(yearStr);
      targets.forEach((target, qi) => {
        const quarter = qi + 1;
        const month = [1, 4, 7, 10][qi];
        const closedAt = new Date(Date.UTC(year, month, 15));
        const available = historyCustomers.filter(
          (c) =>
            c.acquisitionDate.getTime() <= closedAt.getTime() &&
            (c.status !== 'churned' || (c.lastInteractionDate ?? c.acquisitionDate).getTime() >= closedAt.getTime())
        );
        const cust = available[(year + quarter) % available.length];
        const prodIdx = (year * 4 + quarter) % historyProducts.length;
        const product = historyProducts[prodIdx % historyProducts.length];
        const category = product.includes('Security') ? 'Security' : product.includes('Analytics') ? 'Analytics' : 'Software';
        const amountA = Math.round((target * 0.55) / 1000) * 1000;
        const amountB = target - amountA;
        for (const [suffix, amount] of [['A', amountA], ['B', amountB]] as const) {
          historySales.push({
            organizationId: org._id,
            customerId: cust._id,
            salesRepId: manager._id,
            departmentId: deptSales._id,
            dealId: `DEAL-${year}Q${quarter}-${suffix}`,
            productName: product,
            category,
            amount,
            unitPrice: amount,
            quantity: 1,
            region: historyRegions[(year + quarter) % historyRegions.length],
            channel: historyChannels[(year + quarter) % historyChannels.length],
            stage: 'closed_won',
            closedAt,
            probability: 100,
            period: { year, quarter, month },
          });
        }
      });
    }
    await SalesRecord.create(historySales);
    logger.info('Sales records created.');

    // 9. Create Support Tickets
    logger.info('Creating support tickets...');
    const ticketStark = await SupportTicket.create({
      organizationId: org._id,
      ticketId: 'TKT-1001',
      customerId: custStark._id,
      assignedTo: admin._id, // Support Agent admin
      title: 'Stark ERP API Outage',
      description: 'The ERP custom integration failed after the latest patch, blocking sales operations.',
      category: 'Integration',
      priority: 'critical',
      status: 'in_progress',
      channel: 'email',
    });

    await SupportTicket.create({
      organizationId: org._id,
      ticketId: 'TKT-1002',
      customerId: custWayne._id,
      assignedTo: admin._id,
      title: 'Logistics Analytics dashboard latency',
      description: 'Dashboard takes 10+ seconds to load queries related to previous months.',
      category: 'Performance',
      priority: 'medium',
      status: 'resolved',
      channel: 'portal',
      resolutionTimeHours: 18,
      satisfactionRating: 4,
    });
    logger.info('Support tickets created.');

    // 10. Pre-create some risks
    logger.info('Creating standard risks...');
    await Risk.create([
      {
        organizationId: org._id,
        title: 'Customer Churn Risk',
        description: 'Stark Industries reported high integration issues due to delayed analytics engine release.',
        category: 'Operational',
        level: 'high',
        probability: 78,
        impact: 85,
        riskScore: 66,
        status: 'identified',
        ownerId: admin._id,
        departmentId: deptCS._id,
        relatedEntities: [
          { entityType: 'customer', entityId: custStark._id.toString() },
          { entityType: 'project', entityId: projCSO._id.toString() },
        ],
        mitigationStrategies: [
          'Assign senior engineering consultant to fix Stark integration.',
          'Schedule CEO alignment sync to reset roadmap timelines.',
        ],
      },
      {
        organizationId: org._id,
        title: 'Competitor Market Expansion',
        description: 'Competitor Y launched aggressive mid-market pricing in West region, threatening SMB sales.',
        category: 'Market',
        level: 'medium',
        probability: 60,
        impact: 70,
        riskScore: 42,
        status: 'assessing',
        ownerId: manager._id,
        departmentId: deptSales._id,
        relatedEntities: [
          { entityType: 'customer', entityId: custStark._id.toString() },
        ],
        mitigationStrategies: [
          'Implement flexible discounting framework for key accounts.',
          'Differentiate product capabilities highlighting secure audit features.',
        ],
      },
    ]);
    logger.info('Risks created.');

    // 11. Create physical mock text files on disk
    logger.info('Creating physical documents for ingestion...');
    const uploadsDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const doc1Path = path.join(uploadsDir, 'q2_business_review.txt');
    const doc2Path = path.join(uploadsDir, 'competitor_threats.txt');
    const doc3Path = path.join(uploadsDir, 'success_targets.txt');

    fs.writeFileSync(
      doc1Path,
      `Enterprise Inc. Q2 2026 Business Performance Review

This document reviews the financial and operational performance of Enterprise Inc. for the second quarter of 2026.
Our total sales revenue for Q2 decreased to $310,000, representing a significant decline of 40.4% compared to Q1 2026, which recorded $520,000 in sales.
This decline was primarily caused by:
1. Product Release Delay: The R&D department, led by employee Dr. Charles Stark, delayed the release of Product X, our next-generation software package. This delay prevented the Sales department, managed by executive John Doe, from closing key pipeline deals.
2. Mid-Market Churn: Customer churn has increased, particularly in the mid-market segment. Key customers like Stark Industries (account managed by Alice Johnson) have indicated dissatisfaction with the delay in feature releases. Stark Industries is at risk of churning due to this.
3. Competitor Market Expansion: Competitor Y has expanded its presence in the West region, offering aggressive discounts that impacted our sales in California and Oregon.

Recommendations:
- The R&D department must prioritize the release of Product X.
- Customer Success must launch proactive outreach to Stark Industries and other mid-market accounts.`
    );

    fs.writeFileSync(
      doc2Path,
      `Market Competitor Analysis and Threat Assessment

Competitor Y has recently launched a competing product in the West region.
This has directly impacted our enterprise accounts.
Employee Alice Johnson, Account Manager at Enterprise Inc, reported that Stark Industries is reviewing Competitor Y's offering. Stark Industries has a contract value of $150,000, and losing them would significantly impact our Q3 sales targets.
Our Sales department must work with the Product Team to address Stark Industries' requirements.`
    );

    fs.writeFileSync(
      doc3Path,
      `Customer Success & Service Guidelines

This document outlines key performance indicators for the Customer Success department.
Support tickets must be resolved within 24 hours.
Customer satisfaction rating should be maintained above 4.5 out of 5.
Account managers must check in with customers at least once a month.
Customers Stark Industries and Wayne Enterprises have reported high priority tickets regarding integration issues.
Employee Bob Smith is assigned to resolve Stark Industries' tickets.`
    );
    logger.info('Physical files written to uploads folder.');

    // 12. Seed Document records in database
    logger.info('Creating Document records...');
    const d1 = await DocumentModel.create({
      title: 'Q2 Business Performance Review',
      description: 'Analysis of Q2 revenue decrease, delays in Product X, and regional sales drops.',
      fileName: 'q2_business_review.txt',
      fileSize: fs.statSync(doc1Path).size,
      mimeType: 'text/plain',
      documentType: 'txt',
      filePath: doc1Path,
      organizationId: org._id,
      uploadedBy: admin._id,
      departmentId: deptSales._id,
      accessLevel: 'internal',
      tags: ['sales', 'performance', 'q2', 'review'],
      processingStatus: 'pending',
    });

    const d2 = await DocumentModel.create({
      title: 'Competitor Threats & Analysis - West Region',
      description: 'Detailing Competitor Y expansion and Stark Industries threat details.',
      fileName: 'competitor_threats.txt',
      fileSize: fs.statSync(doc2Path).size,
      mimeType: 'text/plain',
      documentType: 'txt',
      filePath: doc2Path,
      organizationId: org._id,
      uploadedBy: admin._id,
      departmentId: deptSales._id,
      accessLevel: 'confidential',
      tags: ['competitor', 'risk', 'west'],
      processingStatus: 'pending',
    });

    const d3 = await DocumentModel.create({
      title: 'Customer Success Operations Manual',
      description: 'CS KPIs, support ticket guidelines, and client targets.',
      fileName: 'success_targets.txt',
      fileSize: fs.statSync(doc3Path).size,
      mimeType: 'text/plain',
      documentType: 'txt',
      filePath: doc3Path,
      organizationId: org._id,
      uploadedBy: admin._id,
      departmentId: deptCS._id,
      accessLevel: 'public',
      tags: ['cs', 'kpis', 'guidelines'],
      processingStatus: 'pending',
    });
    logger.info('Document records created.');

    // 13. Trigger synchronous document ingestion
    logger.info('Ingesting Document 1...');
    await ingestDocument(d1._id.toString());
    logger.info('Ingesting Document 2...');
    await ingestDocument(d2._id.toString());
    logger.info('Ingesting Document 3...');
    await ingestDocument(d3._id.toString());
    logger.info('Document ingestion pipeline executed successfully.');

    // 14. Prepopulate Knowledge Entities & Relationships to guarantee connected Graph
    logger.info('Populating Graph entities and relationships...');
    const kgOrg = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'Enterprise Inc',
      type: 'organization',
      description: 'Main enterprise company',
      sourceDocumentIds: [d1._id],
    });

    const kgSalesDept = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'Sales & Revenue Operations',
      type: 'department',
      description: 'Sales and revenue department',
      sourceDocumentIds: [d1._id],
    });

    const kgCSDept = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'Customer Success & Support',
      type: 'department',
      description: 'CS and technical support',
      sourceDocumentIds: [d3._id],
    });

    const kgRDDept = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'Research & Product Development',
      type: 'department',
      description: 'Product R&D engineering',
      sourceDocumentIds: [d1._id],
    });

    const kgCEO = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'John Doe',
      type: 'employee',
      description: 'CEO and Sales manager',
      sourceDocumentIds: [d1._id],
    });

    const kgEmpAlice = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'Alice Johnson',
      type: 'employee',
      description: 'Account Manager CS',
      sourceDocumentIds: [d2._id],
    });

    const kgEmpCharles = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'Charles Stark',
      type: 'employee',
      description: 'Principal Engineer in R&D',
      sourceDocumentIds: [d1._id],
    });

    const kgProductX = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'Product X',
      type: 'product',
      description: 'Delayed analytics engine software',
      sourceDocumentIds: [d1._id],
    });

    const kgCustStark = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'Stark Industries',
      type: 'customer',
      description: 'Key enterprise account at risk',
      sourceDocumentIds: [d1._id, d2._id],
    });

    const kgCustWayne = await KnowledgeEntity.create({
      organizationId: org._id,
      name: 'Wayne Enterprises',
      type: 'customer',
      description: 'High value customer account',
      sourceDocumentIds: [d3._id],
    });

    // Seed relationships
    await KnowledgeRelationship.create([
      {
        organizationId: org._id,
        fromEntityId: kgCEO._id,
        toEntityId: kgOrg._id,
        relationshipType: 'works_for',
        label: 'works for',
        sourceDocumentIds: [d1._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgEmpAlice._id,
        toEntityId: kgOrg._id,
        relationshipType: 'works_for',
        label: 'works for',
        sourceDocumentIds: [d2._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgEmpCharles._id,
        toEntityId: kgOrg._id,
        relationshipType: 'works_for',
        label: 'works for',
        sourceDocumentIds: [d1._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgCEO._id,
        toEntityId: kgSalesDept._id,
        relationshipType: 'manages',
        label: 'manages',
        sourceDocumentIds: [d1._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgEmpAlice._id,
        toEntityId: kgCSDept._id,
        relationshipType: 'belongs_to',
        label: 'belongs to',
        sourceDocumentIds: [d2._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgEmpCharles._id,
        toEntityId: kgRDDept._id,
        relationshipType: 'belongs_to',
        label: 'belongs to',
        sourceDocumentIds: [d1._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgSalesDept._id,
        toEntityId: kgOrg._id,
        relationshipType: 'belongs_to',
        label: 'belongs to',
        sourceDocumentIds: [d1._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgCSDept._id,
        toEntityId: kgOrg._id,
        relationshipType: 'belongs_to',
        label: 'belongs to',
        sourceDocumentIds: [d3._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgRDDept._id,
        toEntityId: kgOrg._id,
        relationshipType: 'belongs_to',
        label: 'belongs to',
        sourceDocumentIds: [d1._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgCustStark._id,
        toEntityId: kgOrg._id,
        relationshipType: 'partners_with',
        label: 'partners with',
        sourceDocumentIds: [d1._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgCustWayne._id,
        toEntityId: org._id,
        relationshipType: 'partners_with',
        label: 'partners with',
        sourceDocumentIds: [d3._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgCustStark._id,
        toEntityId: kgProductX._id,
        relationshipType: 'purchased',
        label: 'purchased',
        sourceDocumentIds: [d1._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgEmpAlice._id,
        toEntityId: kgCustStark._id,
        relationshipType: 'contacted',
        label: 'manages account for',
        sourceDocumentIds: [d2._id],
      },
      {
        organizationId: org._id,
        fromEntityId: kgRDDept._id,
        toEntityId: kgProductX._id,
        relationshipType: 'works_on',
        label: 'develops',
        sourceDocumentIds: [d1._id],
      },
    ]);
    logger.info('Knowledge graph entities and relationships seeded.');

    // 15. Seed the universal company knowledge base
    logger.info('Seeding universal company knowledge base...');
    const companySeed = await seedCompanies();
    await syncCompanyIndexes();
    logger.info(`Company knowledge base: ${companySeed.inserted} new, ${companySeed.updated} updated.`);

    // 16. Seed sample Decision Intelligence entries
    logger.info('Seeding Decision Intelligence sample decisions...');
    await Decision.create([
      {
        organizationId: org._id,
        createdBy: admin._id,
        title: 'Expand into the SMB segment with a self-serve onboarding tier',
        decision: 'Expand into the SMB segment with a self-serve onboarding tier',
        category: 'growth',
        department: 'Sales',
        budget: '$50k - $100k',
        riskTolerance: 'Medium',
        status: 'evaluated',
        priority: 'high',
        summary:
          'Pursuing the SMB segment broadens the pipeline and diversifies revenue concentration, which currently leans heavily on a few enterprise accounts. A self-serve tier lowers sales cost per deal, though revenue contribution will initially be small.',
        opportunities: [
          'Adds a high-volume, lower-cost acquisition channel.',
          'Diversifies revenue away from a concentrated enterprise book.',
          'Feeds richer behavioral data into the knowledge graph.',
        ],
        risks: [
          'Self-serve can dilute support quality if onboarding automation is immature.',
          'Near-term margin pressure while the tier ramps.',
        ],
        expectedImpact:
          'Budget $50k-$100k for self-serve onboarding tooling; expect modest first-year revenue with a payback window of two quarters at current conversion assumptions.',
        recommendation: 'Proceed — start with a pilot segment (SMB, standardized product) and gate expansion on activation metrics.',
        confidence: 0.82,
        rewardRatio: 'High',
        scenarios: [
          { name: 'Conservative', outcome: 'Slow ramp; 40 new SMB customers in year one with flat enterprise pipeline.' },
          { name: 'Expected', outcome: '120 new SMB customers; enterprise concentration drops ~8 points.' },
          { name: 'Aggressive', outcome: 'Fast self-serve adoption displaces some direct sales capacity.' },
        ],
        supportingMetrics: [
          { label: 'Total historic revenue', value: '$7,730,000' },
          { label: 'Active enterprise customers', value: 3 },
          { label: 'Active at-risk customers', value: 1 },
        ],
        supportingDocuments: [
          { title: 'Q2 Business Review', source: 'document' },
          { title: 'Competitor Threats', source: 'document' },
        ],
        relatedEntities: [
          { name: 'Stark Industries', type: 'customer' },
          { name: 'Wayne Enterprises', type: 'customer' },
          { name: 'Enterprise Inc', type: 'organization' },
        ],
        expectedOutcome: 'Broaden qualified pipeline and reduce single-customer revenue concentration.',
        tags: ['evaluated', 'growth', 'Sales'],
        evaluatedAt: new Date(),
      },
      {
        organizationId: org._id,
        createdBy: admin._id,
        title: 'Hire 3 senior AI engineers to accelerate the document summarization roadmap',
        decision: 'Hire 3 senior AI engineers to accelerate the document summarization agent roadmap',
        category: 'investment',
        department: 'Engineering',
        budget: '$100k - $500k',
        riskTolerance: 'Medium',
        status: 'implemented',
        priority: 'medium',
        summary:
          'Investing in AI engineering capacity accelerates the summarization agent roadmap and compounds on the existing document intelligence foundation. The main cost is payroll and recruiting latency; the main risk is opportunity cost versus other hiring needs.',
        opportunities: [
          'Faster time-to-market for summarization features that drive document usage.',
          'Stronger in-house AI capability reduces external tooling spend.',
          'Aligns with current product thesis during a hiring-friendly window.',
        ],
        risks: [
          'Senior AI talent is competitive and recruiting may slip the timeline.',
          'Short-term payroll pressure before roadmap features monetize.',
        ],
        expectedImpact:
          'Budget $100k-$500k on headcount; engineering velocity for summarization improves immediately, with product-facing impact after the first quarter.',
        recommendation: 'Proceed — fund the hires and track them against a 90-day prototype milestone before scaling the team.',
        confidence: 0.76,
        rewardRatio: 'Medium',
        scenarios: [
          { name: 'Conservative', outcome: 'One of three roles remains open; roadmap slips one quarter.' },
          { name: 'Expected', outcome: 'Three hires onboard within two quarters; summarization GA lands ahead of schedule.' },
          { name: 'Aggressive', outcome: 'Capacity frees two engineers for adjacent document-workspace features.' },
        ],
        supportingMetrics: [
          { label: 'Total historic revenue', value: '$7,730,000' },
          { label: 'Support tickets open', value: 1 },
        ],
        supportingDocuments: [{ title: 'Success Targets', source: 'document' }],
        relatedEntities: [{ name: 'Product X Engine', type: 'product' }],
        expectedOutcome: 'Document summarization agent shipped by end of Q3.',
        actualOutcome: 'Engineering team expanded; summarization prototype scheduled for pilot review.',
        tags: ['implemented', 'investment', 'Engineering', 'AI'],
        evaluatedAt: new Date(),
      },
    ]);
    logger.info('Decision Intelligence sample decisions seeded.');

    logger.info('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();

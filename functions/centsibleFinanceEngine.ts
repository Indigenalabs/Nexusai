import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action } = payload;
    let result = null;

    // ── 1. STRATEGIC FINANCIAL PLANNING & ANALYSIS ──────────────────────────

    if (action === 'automated_budget_forecast') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 200);
      const budgets = await base44.asServiceRole.entities.Budget.list();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a CFO-level financial analyst. Create a comprehensive automated budget and 12-month forecast.
Business context: ${JSON.stringify(payload.business_context || {})}
Historical transactions (last 200): ${JSON.stringify(transactions.map(t => ({ date: t.created_date, amount: t.amount, category: t.category, type: t.type })))}
Current budgets: ${JSON.stringify(budgets)}

Deliver:
1. Annual budget by category (monthly breakdown)
2. Revenue forecast (optimistic / base / conservative)
3. Expense forecast with seasonality adjustments
4. Break-even analysis
5. Burn rate and runway (months)
6. Budget variance alerts (categories at risk)
7. Budget reallocation recommendations
8. Key assumptions and drivers`,
        response_json_schema: {
          type: 'object', properties: {
            annual_revenue_forecast: { type: 'number' },
            annual_expense_forecast: { type: 'number' },
            net_profit_forecast: { type: 'number' },
            runway_months: { type: 'number' },
            monthly_breakdown: { type: 'array', items: { type: 'object', properties: { month: { type: 'string' }, revenue: { type: 'number' }, expenses: { type: 'number' }, net: { type: 'number' } } } },
            budget_by_category: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, allocated: { type: 'number' }, forecast: { type: 'number' }, variance: { type: 'number' } } } },
            at_risk_categories: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            key_assumptions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'scenario_modeling') {
      const financials = await base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 12);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a CFO running Monte Carlo scenario modeling. Analyze the what-if scenario provided.
Scenario: ${payload.scenario_description}
Variables changed: ${JSON.stringify(payload.variables || {})}
Current financials: ${JSON.stringify(financials.slice(0, 6))}

Model 3 scenarios (conservative / base / aggressive):
1. P&L impact (revenue, COGS, gross margin, EBITDA)
2. Cash flow impact (monthly for 12 months)
3. Balance sheet impact
4. Break-even change
5. Risk factors
6. Recommendation: proceed / modify / avoid
7. Key milestones and decision points`,
        response_json_schema: {
          type: 'object', properties: {
            scenario_name: { type: 'string' },
            conservative: { type: 'object', properties: { revenue_impact: { type: 'number' }, cost_impact: { type: 'number' }, net_impact: { type: 'number' }, probability: { type: 'number' } } },
            base: { type: 'object', properties: { revenue_impact: { type: 'number' }, cost_impact: { type: 'number' }, net_impact: { type: 'number' }, probability: { type: 'number' } } },
            aggressive: { type: 'object', properties: { revenue_impact: { type: 'number' }, cost_impact: { type: 'number' }, net_impact: { type: 'number' }, probability: { type: 'number' } } },
            recommendation: { type: 'string' },
            risks: { type: 'array', items: { type: 'string' } },
            milestones: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'kpi_dashboard') {
      const [transactions, invoices, budgets, snapshots] = await Promise.all([
        base44.asServiceRole.entities.Transaction.list('-created_date', 200),
        base44.asServiceRole.entities.Invoice.list('-created_date', 50),
        base44.asServiceRole.entities.Budget.list(),
        base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 6),
      ]);
      const totalRevenue = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const overdueInvoices = invoices.filter(i => i.status === 'overdue');
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive executive KPI dashboard and ratio analysis.
Revenue: $${totalRevenue}, Expenses: $${totalExpenses}
Invoices: ${invoices.length} total, ${overdueInvoices.length} overdue
Budget utilization: ${JSON.stringify(budgets.map(b => ({ category: b.category, allocated: b.amount, spent: b.spent })))}
Historical snapshots: ${JSON.stringify(snapshots)}

Calculate and present:
1. Liquidity ratios (current ratio, quick ratio, cash ratio)
2. Profitability ratios (gross margin, net margin, EBITDA margin, ROE, ROA)
3. Efficiency ratios (DSO, DPO, asset turnover, revenue per employee)
4. Growth metrics (MoM revenue growth, expense growth, customer growth)
5. Health score (0-100) with breakdown
6. Traffic light status for each KPI (green/amber/red)
7. Top 3 KPIs requiring immediate attention
8. Peer benchmarks for industry`,
        response_json_schema: {
          type: 'object', properties: {
            health_score: { type: 'number' },
            revenue: { type: 'number' },
            expenses: { type: 'number' },
            net_profit: { type: 'number' },
            gross_margin_pct: { type: 'number' },
            net_margin_pct: { type: 'number' },
            current_ratio: { type: 'number' },
            dso_days: { type: 'number' },
            kpis: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' }, status: { type: 'string' }, trend: { type: 'string' } } } },
            alerts: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'benchmarking') {
      const snapshots = await base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 6);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Benchmark this business's financial performance against industry peers.
Business type: ${payload.business_type || 'services'}
Industry: ${payload.industry || 'professional services'}
Current metrics: ${JSON.stringify(payload.metrics || {})}
Historical data: ${JSON.stringify(snapshots.slice(0, 3))}

Provide:
1. Industry benchmark comparisons for: gross margin, CAC, LTV, churn, burn rate, revenue growth, EBITDA margin
2. Percentile ranking for each metric (1st-100th percentile)
3. Gap analysis: where are we behind / ahead of peers?
4. Quick wins to improve metrics
5. Best-in-class examples and targets
6. 90-day improvement roadmap`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object', properties: {
            industry: { type: 'string' },
            benchmarks: { type: 'array', items: { type: 'object', properties: { metric: { type: 'string' }, our_value: { type: 'string' }, industry_avg: { type: 'string' }, best_in_class: { type: 'string' }, percentile: { type: 'number' }, status: { type: 'string' } } } },
            overall_percentile: { type: 'number' },
            quick_wins: { type: 'array', items: { type: 'string' } },
            improvement_roadmap: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 2. CORE ACCOUNTING & BOOKKEEPING ────────────────────────────────────

    if (action === 'generate_invoice') {
      const invoiceData = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a professional invoice for:
Customer: ${payload.customer_name}
Amount: $${payload.amount}
Items: ${JSON.stringify(payload.items || [{ description: 'Professional Services', quantity: 1, rate: payload.amount, total: payload.amount }])}
Payment terms: ${payload.payment_terms || 'Net 30'}
Tax rate: ${payload.tax_rate || 0}%
Notes: ${payload.notes || ''}

Provide: invoice number, due date, subtotal, tax amount, total, and payment instructions.`,
        response_json_schema: {
          type: 'object', properties: {
            invoice_number: { type: 'string' },
            issue_date: { type: 'string' },
            due_date: { type: 'string' },
            subtotal: { type: 'number' },
            tax_amount: { type: 'number' },
            total: { type: 'number' },
            payment_instructions: { type: 'string' }
          }
        }
      });
      const invoice = await base44.asServiceRole.entities.Invoice.create({
        customer_name: payload.customer_name,
        amount: invoiceData.total,
        status: 'sent',
        due_date: invoiceData.due_date,
        items: payload.items || [],
        notes: payload.notes
      });
      result = { invoice_id: invoice.id, ...invoiceData };
    }

    if (action === 'categorize_transactions') {
      const uncategorized = await base44.asServiceRole.entities.Transaction.filter({ category: null });
      const categories = await base44.integrations.Core.InvokeLLM({
        prompt: `Categorize these transactions using ML-like pattern recognition. Assign each to the most appropriate category.
Available categories: revenue, payroll, rent, utilities, software, marketing, travel, meals, office, tax, insurance, professional_services, equipment, other
Transactions: ${JSON.stringify(uncategorized.map(t => ({ id: t.id, description: t.description, amount: t.amount, merchant: t.merchant })))}

For each transaction, provide: id, category, subcategory, confidence_score, is_recurring`,
        response_json_schema: {
          type: 'object', properties: {
            categorizations: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' }, confidence: { type: 'number' }, is_recurring: { type: 'boolean' } } } },
            total_categorized: { type: 'number' }
          }
        }
      });
      // Update each transaction
      for (const cat of (categories.categorizations || [])) {
        await base44.asServiceRole.entities.Transaction.update(cat.id, { category: cat.category, is_recurring: cat.is_recurring });
      }
      result = categories;
    }

    if (action === 'bank_reconciliation') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 100);
      const invoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'paid' });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a bank reconciliation analysis.
Transactions on record: ${JSON.stringify(transactions.map(t => ({ id: t.id, amount: t.amount, date: t.created_date, description: t.description })))}
Paid invoices: ${JSON.stringify(invoices.map(i => ({ id: i.id, amount: i.amount, customer: i.customer_name })))}
Bank statement balance provided: ${payload.bank_balance || 'not provided'}

Identify:
1. Matched transactions (invoice to payment)
2. Unmatched bank transactions
3. Outstanding invoices not yet received
4. Duplicate transactions
5. Timing differences
6. Discrepancies requiring investigation
7. Reconciled balance vs bank balance`,
        response_json_schema: {
          type: 'object', properties: {
            reconciled_balance: { type: 'number' },
            discrepancies: { type: 'number' },
            unmatched_transactions: { type: 'array', items: { type: 'string' } },
            duplicates_found: { type: 'array', items: { type: 'string' } },
            outstanding_invoices_total: { type: 'number' },
            action_items: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'tax_preparation') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 500);
      const period = payload.period || 'FY2025-26';
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Prepare a comprehensive tax summary for ${period} (Australian tax context - GST, BAS, income tax).
All transactions: ${JSON.stringify(transactions.map(t => ({ date: t.created_date, amount: t.amount, category: t.category, description: t.description })))}
Business type: ${payload.business_type || 'company'}
GST registered: ${payload.gst_registered !== false}

Calculate:
1. Total assessable income
2. Allowable deductions by category
3. GST collected vs GST paid (net BAS)
4. Taxable income
5. Estimated tax liability
6. PAYG instalments
7. BAS lodgement amounts (Q1-Q4)
8. Deductions being missed
9. Tax minimization strategies
10. ATO compliance checklist`,
        response_json_schema: {
          type: 'object', properties: {
            period: { type: 'string' },
            total_income: { type: 'number' },
            total_deductions: { type: 'number' },
            taxable_income: { type: 'number' },
            estimated_tax: { type: 'number' },
            gst_collected: { type: 'number' },
            gst_paid: { type: 'number' },
            net_gst_payable: { type: 'number' },
            quarterly_bas: { type: 'array', items: { type: 'object', properties: { quarter: { type: 'string' }, gst_payable: { type: 'number' }, due_date: { type: 'string' } } } },
            missed_deductions: { type: 'array', items: { type: 'string' } },
            tax_strategies: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 3. CASH FLOW MANAGEMENT & OPTIMIZATION ──────────────────────────────

    if (action === 'forecast_cash_flow') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 200);
      const invoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 50);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive cash flow forecast.
Historical transactions (200 recent): ${JSON.stringify(transactions.map(t => ({ date: t.created_date, amount: t.amount, category: t.category, type: t.type })))}
Outstanding invoices: ${JSON.stringify(invoices.filter(i => i.status !== 'paid').map(i => ({ amount: i.amount, due_date: i.due_date, customer: i.customer_name })))}
Forecast period: ${payload.months || 12} months

Provide:
1. Daily cash position for next 30 days
2. Weekly cash flow for next 13 weeks
3. Monthly cash flow for next 12 months
4. Minimum cash balance point and date
5. Cash shortfall warnings with amounts and dates
6. Seasonality patterns detected
7. Cash acceleration strategies (AR)
8. Cash preservation strategies (AP)
9. Working capital optimization opportunities`,
        response_json_schema: {
          type: 'object', properties: {
            current_cash_position: { type: 'number' },
            runway_months: { type: 'number' },
            lowest_point_amount: { type: 'number' },
            lowest_point_date: { type: 'string' },
            shortfalls: { type: 'array', items: { type: 'object', properties: { month: { type: 'string' }, shortfall: { type: 'number' } } } },
            monthly_forecast: { type: 'array', items: { type: 'object', properties: { month: { type: 'string' }, opening: { type: 'number' }, inflows: { type: 'number' }, outflows: { type: 'number' }, closing: { type: 'number' } } } },
            acceleration_strategies: { type: 'array', items: { type: 'string' } },
            preservation_strategies: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'cash_position') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 50);
      const invoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 30);
      const totalIn = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const totalOut = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const pendingAR = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.amount || 0), 0);
      result = {
        current_balance: totalIn - totalOut,
        pending_receivables: pendingAR,
        projected_balance: (totalIn - totalOut) + pendingAR,
        overdue_invoices: invoices.filter(i => i.status === 'overdue').length,
        recent_inflows: totalIn,
        recent_outflows: totalOut
      };
    }

    if (action === 'dynamic_discounting') {
      const invoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'sent' });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze early payment discount opportunities to optimize cash flow.
Outstanding invoices: ${JSON.stringify(invoices.map(i => ({ id: i.id, customer: i.customer_name, amount: i.amount, due_date: i.due_date })))}
Current cash position: $${payload.cash_position || 0}
Cost of capital / interest rate: ${payload.interest_rate || 6}%

Recommend:
1. Which invoices to offer early payment discounts on (and at what %)
2. ROI of each discount offer vs cost of capital
3. Dynamic discount schedule
4. Supplier early payment opportunities (where we can save money)
5. Net working capital impact`,
        response_json_schema: {
          type: 'object', properties: {
            discount_opportunities: { type: 'array', items: { type: 'object', properties: { invoice_id: { type: 'string' }, customer: { type: 'string' }, amount: { type: 'number' }, recommended_discount_pct: { type: 'number' }, roi: { type: 'number' }, rationale: { type: 'string' } } } },
            total_potential_acceleration: { type: 'number' },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 4. COST CONTROL & PROCUREMENT INTELLIGENCE ──────────────────────────

    if (action === 'spend_analysis') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 300);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a comprehensive spend analysis and identify cost savings.
All expense transactions: ${JSON.stringify(transactions.filter(t => t.amount < 0).map(t => ({ date: t.created_date, amount: Math.abs(t.amount), category: t.category, description: t.description, merchant: t.merchant })))}

Analyze:
1. Total spend by category (ranked)
2. Top 10 vendors by spend
3. Spend trend (MoM change per category)
4. Subscription bloat: recurring charges that may be unused
5. Duplicate payments detected
6. Maverick spend (outside approved vendors)
7. Price anomalies (same vendor, different prices)
8. Consolidation opportunities
9. Negotiation leverage points
10. Estimated savings achievable: $X`,
        response_json_schema: {
          type: 'object', properties: {
            total_spend: { type: 'number' },
            by_category: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, amount: { type: 'number' }, pct_of_total: { type: 'number' }, mom_change: { type: 'number' } } } },
            top_vendors: { type: 'array', items: { type: 'object', properties: { vendor: { type: 'string' }, total: { type: 'number' } } } },
            subscriptions_detected: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, monthly_cost: { type: 'number' }, last_used: { type: 'string' } } } },
            duplicates: { type: 'array', items: { type: 'string' } },
            estimated_savings: { type: 'number' },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'vendor_optimization') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 200);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize vendor relationships and contracts to reduce costs.
Vendor spending history: ${JSON.stringify(transactions.filter(t => t.amount < 0).map(t => ({ vendor: t.merchant, amount: Math.abs(t.amount), category: t.category, date: t.created_date })))}
Industry benchmarks: search the web for current SaaS and service pricing benchmarks.

For top 10 vendors:
1. Total spend and trend
2. Market price benchmark (are we overpaying?)
3. Renegotiation script/talking points
4. Alternative vendors with pricing
5. Consolidation opportunities
6. Contract terms to push for
7. Priority negotiation order (highest ROI first)
8. Estimated savings per vendor`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object', properties: {
            vendor_analysis: { type: 'array', items: { type: 'object', properties: { vendor: { type: 'string' }, current_spend: { type: 'number' }, market_price: { type: 'string' }, overpaying_by: { type: 'number' }, negotiation_tip: { type: 'string' }, alternative: { type: 'string' }, savings_potential: { type: 'number' } } } },
            total_savings_potential: { type: 'number' },
            priority_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'subscription_audit') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 300);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Conduct a full subscription and SaaS audit.
All transactions: ${JSON.stringify(transactions.filter(t => t.amount < 0).map(t => ({ merchant: t.merchant, amount: Math.abs(t.amount), date: t.created_date, description: t.description })))}

Identify:
1. All recurring subscriptions (group by merchant)
2. Monthly and annual cost per subscription
3. Subscriptions not used in last 30 days
4. Duplicate tools (same function, multiple tools)
5. Free tier alternatives available
6. Usage-to-cost ratio assessment
7. Cancel immediately: highest waste
8. Downgrade opportunities
9. Annual prepay savings available
10. Total potential savings`,
        response_json_schema: {
          type: 'object', properties: {
            subscriptions: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, monthly_cost: { type: 'number' }, annual_cost: { type: 'number' }, category: { type: 'string' }, status: { type: 'string' }, action: { type: 'string' } } } },
            total_monthly_subscriptions: { type: 'number' },
            cancel_immediately: { type: 'array', items: { type: 'string' } },
            downgrade_candidates: { type: 'array', items: { type: 'string' } },
            potential_savings_monthly: { type: 'number' }
          }
        }
      });
    }

    // ── 5. REVENUE & BILLING OPTIMIZATION ───────────────────────────────────

    if (action === 'revenue_optimization') {
      const invoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 100);
      const transactions = await base44.asServiceRole.entities.Transaction.filter({ type: 'income' });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze and optimize revenue streams for maximum growth.
Invoice history: ${JSON.stringify(invoices.map(i => ({ customer: i.customer_name, amount: i.amount, status: i.status, date: i.created_date })))}
Revenue transactions: ${JSON.stringify(transactions.slice(0, 100).map(t => ({ amount: t.amount, category: t.category, date: t.created_date })))}

Provide:
1. Revenue by customer (top 10, concentration risk)
2. Average revenue per customer
3. Customer lifetime value (LTV) estimates
4. Churn analysis (customers who stopped paying)
5. Upsell opportunities by customer profile
6. Cross-sell recommendations
7. Pricing tier optimization
8. Revenue recognition schedule
9. Recurring vs one-off revenue breakdown
10. Revenue growth strategies`,
        response_json_schema: {
          type: 'object', properties: {
            total_revenue: { type: 'number' },
            top_customers: { type: 'array', items: { type: 'object', properties: { customer: { type: 'string' }, revenue: { type: 'number' }, pct_of_total: { type: 'number' }, ltv_estimate: { type: 'number' } } } },
            avg_revenue_per_customer: { type: 'number' },
            recurring_revenue: { type: 'number' },
            churn_detected: { type: 'array', items: { type: 'string' } },
            upsell_opportunities: { type: 'array', items: { type: 'string' } },
            growth_strategies: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'dunning_management') {
      const overdueInvoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'overdue' });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a dunning and collections strategy for overdue invoices.
Overdue invoices: ${JSON.stringify(overdueInvoices.map(i => ({ id: i.id, customer: i.customer_name, amount: i.amount, due_date: i.due_date, days_overdue: Math.floor((Date.now() - new Date(i.due_date)) / 86400000) })))}

For each invoice, provide:
1. Days overdue tier (1-7, 8-30, 31-60, 60+)
2. Recommended contact method and tone
3. Personalized email/SMS message
4. Payment plan options to offer
5. Escalation path (when to involve collections)
6. Risk of write-off assessment
7. Total AR at risk`,
        response_json_schema: {
          type: 'object', properties: {
            total_overdue: { type: 'number' },
            by_tier: { type: 'object', properties: { tier_1_7: { type: 'number' }, tier_8_30: { type: 'number' }, tier_31_60: { type: 'number' }, tier_60_plus: { type: 'number' } } },
            actions: { type: 'array', items: { type: 'object', properties: { invoice_id: { type: 'string' }, customer: { type: 'string' }, amount: { type: 'number' }, days_overdue: { type: 'number' }, action: { type: 'string' }, message: { type: 'string' }, risk: { type: 'string' } } } },
            collection_priority: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 6. FINANCIAL RISK MANAGEMENT & COMPLIANCE ───────────────────────────

    if (action === 'anomaly_detection') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 200);
      const anomalies = await base44.integrations.Core.InvokeLLM({
        prompt: `Run advanced anomaly detection and fraud analysis on these transactions.
Transactions: ${JSON.stringify(transactions.map(t => ({ id: t.id, date: t.created_date, amount: t.amount, category: t.category, description: t.description, merchant: t.merchant })))}

Detect:
1. Statistical outliers (amounts > 2 std deviations from mean)
2. Duplicate transactions (same amount, merchant, within 48h)
3. Round-number transactions (potential fraud)
4. Late night / weekend transactions
5. New vendors with high values
6. Velocity anomalies (sudden spend spike)
7. Category misclassifications
8. Potential expense fraud patterns
9. Unauthorized recurring charges
For each: severity (low/medium/high/critical), description, recommended action`,
        response_json_schema: {
          type: 'object', properties: {
            total_analyzed: { type: 'number' },
            anomalies_found: { type: 'number' },
            fraud_risk_score: { type: 'number' },
            alerts: { type: 'array', items: { type: 'object', properties: { transaction_id: { type: 'string' }, type: { type: 'string' }, severity: { type: 'string' }, description: { type: 'string' }, amount: { type: 'number' }, action: { type: 'string' } } } },
            high_risk_items: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      // Flag anomalies in DB
      for (const alert of (anomalies.alerts || []).filter(a => a.transaction_id && ['high', 'critical'].includes(a.severity))) {
        await base44.asServiceRole.entities.Transaction.update(alert.transaction_id, { is_anomaly: true }).catch(() => {});
      }
      result = anomalies;
    }

    if (action === 'credit_risk_assessment') {
      const invoices = await base44.asServiceRole.entities.Invoice.filter({ customer_name: payload.customer_name });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess credit risk for customer: ${payload.customer_name}
Payment history: ${JSON.stringify(invoices.map(i => ({ amount: i.amount, status: i.status, due_date: i.due_date })))}
Requested credit limit: $${payload.requested_limit || 10000}
Industry: ${payload.industry || 'unknown'}

Provide:
1. Credit score (0-100)
2. Payment behavior analysis
3. Days Sales Outstanding (DSO) for this customer
4. Late payment frequency and severity
5. Recommended credit limit
6. Recommended payment terms
7. Risk rating (A/B/C/D/F)
8. Any red flags`,
        response_json_schema: {
          type: 'object', properties: {
            credit_score: { type: 'number' },
            risk_rating: { type: 'string' },
            recommended_credit_limit: { type: 'number' },
            recommended_terms: { type: 'string' },
            dso_days: { type: 'number' },
            late_payment_rate: { type: 'number' },
            red_flags: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' }
          }
        }
      });
    }

    if (action === 'compliance_check') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 100);
      const invoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 50);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a financial compliance audit.
Transactions: ${JSON.stringify(transactions.map(t => ({ amount: t.amount, category: t.category, description: t.description })))}
Invoices: ${JSON.stringify(invoices.slice(0, 20).map(i => ({ amount: i.amount, status: i.status, customer: i.customer_name })))}
Jurisdiction: ${payload.jurisdiction || 'Australia'}
Business type: ${payload.business_type || 'company'}

Check compliance with:
1. GST/VAT obligations (correct rates applied)
2. BAS lodgement requirements
3. Superannuation obligations (SG rate)
4. PAYG withholding requirements
5. ATO record-keeping standards (5-year rule)
6. FBT applicability
7. Division 7A compliance (loans to shareholders)
8. Payroll tax thresholds
9. Workers compensation
10. Privacy Act (financial data)
Flag: non-compliant items, upcoming deadlines, penalty risks`,
        response_json_schema: {
          type: 'object', properties: {
            overall_compliance_score: { type: 'number' },
            compliant_areas: { type: 'array', items: { type: 'string' } },
            non_compliant_items: { type: 'array', items: { type: 'object', properties: { area: { type: 'string' }, issue: { type: 'string' }, penalty_risk: { type: 'string' }, action_required: { type: 'string' }, deadline: { type: 'string' } } } },
            upcoming_deadlines: { type: 'array', items: { type: 'object', properties: { obligation: { type: 'string' }, due_date: { type: 'string' } } } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 7. INVESTOR & STAKEHOLDER COMMUNICATION ─────────────────────────────

    if (action === 'investor_report') {
      const [transactions, snapshots, invoices] = await Promise.all([
        base44.asServiceRole.entities.Transaction.list('-created_date', 200),
        base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 12),
        base44.asServiceRole.entities.Invoice.list('-created_date', 50),
      ]);
      const revenue = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a professional investor/board report for ${payload.period || 'this month'}.
Revenue: $${revenue}, Expenses: $${expenses}, Net: $${revenue - expenses}
Historical snapshots: ${JSON.stringify(snapshots.slice(0, 6))}
Outstanding invoices: ${invoices.filter(i => i.status !== 'paid').length}

Create a complete investor update including:
1. Executive summary (key narrative)
2. Revenue and growth metrics (MoM, YoY)
3. Expense breakdown and efficiency
4. Cash position and runway
5. Key wins this period
6. Challenges and mitigations
7. Forward guidance (next quarter)
8. Ask / decision items for board
9. Appendix: detailed financial tables

Write in professional investor-grade language.`,
        response_json_schema: {
          type: 'object', properties: {
            period: { type: 'string' },
            executive_summary: { type: 'string' },
            revenue: { type: 'number' },
            revenue_growth_mom: { type: 'number' },
            expenses: { type: 'number' },
            net_profit: { type: 'number' },
            cash_position: { type: 'number' },
            runway_months: { type: 'number' },
            key_wins: { type: 'array', items: { type: 'string' } },
            challenges: { type: 'array', items: { type: 'string' } },
            forward_guidance: { type: 'string' },
            board_asks: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'virtual_cfo_qa') {
      const [transactions, budgets, invoices, snapshots] = await Promise.all([
        base44.asServiceRole.entities.Transaction.list('-created_date', 100),
        base44.asServiceRole.entities.Budget.list(),
        base44.asServiceRole.entities.Invoice.list('-created_date', 30),
        base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 6),
      ]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are the Virtual CFO. Answer this financial question with precision, context, and strategic insight.
Question: ${payload.question}
Financial context:
- Recent transactions: ${transactions.length} records
- Revenue (recent): $${transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0).toLocaleString()}
- Expenses (recent): $${transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}
- Active budgets: ${budgets.length}
- Open invoices: ${invoices.filter(i => i.status !== 'paid').length}
- Historical snapshots: ${JSON.stringify(snapshots.slice(0, 3))}

Provide a detailed, CFO-quality answer with:
1. Direct answer to the question
2. Supporting data and analysis
3. Context and caveats
4. Strategic implications
5. Recommended next steps`,
        response_json_schema: {
          type: 'object', properties: {
            answer: { type: 'string' },
            supporting_data: { type: 'array', items: { type: 'string' } },
            caveats: { type: 'array', items: { type: 'string' } },
            next_steps: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'fundraising_support') {
      const snapshots = await base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 12);
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 200);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Prepare comprehensive fundraising financial materials.
Raise type: ${payload.raise_type || 'Series A'}
Target raise: $${payload.target_amount || 1000000}
Business type: ${payload.business_type || 'SaaS'}
Financial history: ${JSON.stringify(snapshots.slice(0, 6))}
Revenue transactions: ${transactions.filter(t => t.amount > 0).length} records

Create:
1. 5-year financial model (P&L, cash flow, balance sheet projections)
2. Use of funds breakdown
3. Key investment metrics (IRR, ROI, payback period)
4. Valuation range (3 methods: DCF, revenue multiple, comparables)
5. Dilution scenarios (20%, 25%, 30% equity)
6. Key milestones to achieve with this funding
7. Risk factors and mitigations
8. Data room checklist`,
        response_json_schema: {
          type: 'object', properties: {
            raise_type: { type: 'string' },
            target_amount: { type: 'number' },
            pre_money_valuation_range: { type: 'string' },
            use_of_funds: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, amount: { type: 'number' }, pct: { type: 'number' } } } },
            five_year_revenue_forecast: { type: 'array', items: { type: 'number' } },
            key_metrics: { type: 'object', properties: { projected_irr: { type: 'number' }, payback_months: { type: 'number' }, ltv_cac_ratio: { type: 'number' } } },
            dilution_scenarios: { type: 'array', items: { type: 'object', properties: { equity_pct: { type: 'number' }, valuation: { type: 'number' }, investor_share: { type: 'number' } } } },
            milestones: { type: 'array', items: { type: 'string' } },
            data_room_checklist: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ── 8. CROSS-AGENT COLLABORATION & FULL BRIEFING ─────────────────────────

    if (action === 'financial_health_check') {
      const [transactions, budgets, invoices, snapshots] = await Promise.all([
        base44.asServiceRole.entities.Transaction.list('-created_date', 200),
        base44.asServiceRole.entities.Budget.list(),
        base44.asServiceRole.entities.Invoice.list('-created_date', 50),
        base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 6),
      ]);
      const totalInc = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const totalExp = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const overdue = invoices.filter(i => i.status === 'overdue');
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a CFO conducting a full financial health check. Be comprehensive and actionable.
Income: $${totalInc}, Expenses: $${totalExp}, Net: $${totalInc - totalExp}
Overdue invoices: ${overdue.length} totaling $${overdue.reduce((s, i) => s + (i.amount || 0), 0)}
Budget utilization: ${JSON.stringify(budgets.map(b => ({ category: b.category, pct_used: ((b.spent || 0) / (b.amount || 1) * 100).toFixed(0) + '%' })))}
Historical: ${JSON.stringify(snapshots.slice(0, 3))}

Deliver a comprehensive health check:
1. Overall financial health score (0-100) with grade (A-F)
2. Cash flow health (positive/negative/at risk)
3. Profitability analysis
4. Debt and liability review
5. Revenue quality (recurring vs one-off)
6. Budget adherence (which categories are over/under)
7. Working capital efficiency
8. Top 5 financial risks right now
9. Top 5 immediate actions required
10. 30/60/90-day financial priorities`,
        response_json_schema: {
          type: 'object', properties: {
            health_score: { type: 'number' },
            grade: { type: 'string' },
            revenue: { type: 'number' },
            expenses: { type: 'number' },
            net_profit: { type: 'number' },
            profit_margin_pct: { type: 'number' },
            cash_flow_status: { type: 'string' },
            overdue_ar: { type: 'number' },
            budget_status: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, status: { type: 'string' }, pct_used: { type: 'number' } } } },
            risks: { type: 'array', items: { type: 'string' } },
            immediate_actions: { type: 'array', items: { type: 'string' } },
            priorities_30_60_90: { type: 'object', properties: { day_30: { type: 'array', items: { type: 'string' } }, day_60: { type: 'array', items: { type: 'string' } }, day_90: { type: 'array', items: { type: 'string' } } } }
          }
        }
      });
    }

    if (action === 'track_transactions') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 100);
      const tracking = {
        total_transactions: transactions.length,
        total_income: transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),
        total_expenses: transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
        by_category: {}
      };
      for (const tx of transactions) {
        const cat = tx.category || 'other';
        tracking.by_category[cat] = (tracking.by_category[cat] || 0) + Math.abs(tx.amount || 0);
      }
      const pnl = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate P&L analysis:
Income: $${tracking.total_income}, Expenses: $${tracking.total_expenses}
By category: ${JSON.stringify(tracking.by_category)}
Provide: gross profit, net profit, margin %, largest expense category, and optimization tips.`,
        response_json_schema: {
          type: 'object', properties: {
            net_profit: { type: 'number' },
            profit_margin: { type: 'number' },
            largest_expense: { type: 'string' },
            optimization_tips: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      result = { tracking, pnl };
    }

    if (action === 'payroll_analysis') {
      const transactions = await base44.asServiceRole.entities.Transaction.filter({ category: 'payroll' });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze payroll costs and compliance.
Payroll transactions: ${JSON.stringify(transactions.map(t => ({ amount: Math.abs(t.amount), date: t.created_date, description: t.description })))}
Team size: ${payload.team_size || 'unknown'}
Industry: ${payload.industry || 'services'}

Provide:
1. Total payroll cost (monthly, quarterly, annual)
2. Payroll as % of revenue
3. Cost per FTE
4. Superannuation obligations (11.5% SG from 2024)
5. PAYG withholding estimate
6. Payroll tax threshold check
7. Benchmark: industry payroll % of revenue
8. Optimization recommendations`,
        response_json_schema: {
          type: 'object', properties: {
            total_payroll_monthly: { type: 'number' },
            payroll_pct_of_revenue: { type: 'number' },
            super_obligation: { type: 'number' },
            payg_estimate: { type: 'number' },
            payroll_tax_risk: { type: 'string' },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

        if (action === 'driver_based_planning') {
      const transactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 300);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build a driver-based financial plan.
Inputs: ${JSON.stringify(payload.drivers || {})}
Transactions: ${JSON.stringify(transactions.slice(0, 120).map(t => ({ amount: t.amount, category: t.category, date: t.created_date })))}

Return:
- primary_drivers
- driver_tree
- sensitivity_analysis
- recommended_driver_targets
- impact_summary`,
        response_json_schema: {
          type: 'object', properties: {
            primary_drivers: { type: 'array', items: { type: 'string' } },
            driver_tree: { type: 'array', items: { type: 'object', properties: { driver: { type: 'string' }, current: { type: 'number' }, target: { type: 'number' }, impact: { type: 'string' } } } },
            sensitivity_analysis: { type: 'array', items: { type: 'string' } },
            recommended_driver_targets: { type: 'array', items: { type: 'string' } },
            impact_summary: { type: 'string' }
          }
        }
      });
    }

    if (action === 'long_range_planning') {
      const snapshots = await base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 24);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a 3-5 year long-range financial plan.
Strategy context: ${JSON.stringify(payload.strategy || {})}
Historical snapshots: ${JSON.stringify(snapshots.slice(0, 12))}

Return:
- horizon_years
- revenue_path
- margin_path
- capex_plan
- fundraising_needs
- strategic_risks
- board_recommendations`,
        response_json_schema: {
          type: 'object', properties: {
            horizon_years: { type: 'number' },
            revenue_path: { type: 'array', items: { type: 'object', properties: { year: { type: 'string' }, revenue: { type: 'number' } } } },
            margin_path: { type: 'array', items: { type: 'object', properties: { year: { type: 'string' }, ebitda_margin: { type: 'number' } } } },
            capex_plan: { type: 'array', items: { type: 'string' } },
            fundraising_needs: { type: 'array', items: { type: 'string' } },
            strategic_risks: { type: 'array', items: { type: 'string' } },
            board_recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'treasury_liquidity_optimizer') {
      const [transactions, invoices] = await Promise.all([
        base44.asServiceRole.entities.Transaction.list('-created_date', 200),
        base44.asServiceRole.entities.Invoice.list('-created_date', 80),
      ]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize treasury and liquidity.
Transactions: ${JSON.stringify(transactions.slice(0, 120).map(t => ({ amount: t.amount, category: t.category, date: t.created_date })))}
Invoices: ${JSON.stringify(invoices.slice(0, 80).map(i => ({ amount: i.amount, status: i.status, due_date: i.due_date })))}
Rate environment: ${payload.rate_environment || 'current market'}

Return:
- liquidity_tiers
- sweep_recommendations
- debt_draw_repay_strategy
- covenant_watchouts
- next_30_day_actions`,
        response_json_schema: {
          type: 'object', properties: {
            liquidity_tiers: { type: 'array', items: { type: 'string' } },
            sweep_recommendations: { type: 'array', items: { type: 'string' } },
            debt_draw_repay_strategy: { type: 'array', items: { type: 'string' } },
            covenant_watchouts: { type: 'array', items: { type: 'string' } },
            next_30_day_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'arr_mrr_analytics') {
      const invoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 200);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate ARR/MRR analytics from subscription-like invoice patterns.
Invoices: ${JSON.stringify(invoices.map(i => ({ customer: i.customer_name, amount: i.amount, status: i.status, date: i.created_date })))}

Return:
- mrr_estimate
- arr_estimate
- nrr_estimate
- grr_estimate
- expansion_signals
- contraction_signals
- retention_actions`,
        response_json_schema: {
          type: 'object', properties: {
            mrr_estimate: { type: 'number' },
            arr_estimate: { type: 'number' },
            nrr_estimate: { type: 'number' },
            grr_estimate: { type: 'number' },
            expansion_signals: { type: 'array', items: { type: 'string' } },
            contraction_signals: { type: 'array', items: { type: 'string' } },
            retention_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

        if (action === 'revenue_leakage_scan') {
      const [invoices, transactions] = await Promise.all([
        base44.asServiceRole.entities.Invoice.list('-created_date', 200),
        base44.asServiceRole.entities.Transaction.list('-created_date', 250),
      ]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Detect revenue leakage.
Invoices: ${JSON.stringify(invoices.slice(0, 160).map(i => ({ id: i.id, amount: i.amount, status: i.status, customer: i.customer_name })))}
Transactions: ${JSON.stringify(transactions.slice(0, 160).map(t => ({ amount: t.amount, type: t.type, category: t.category, description: t.description })))}

Return:
- leakage_cases
- missed_billing_patterns
- failed_collection_patterns
- estimated_leakage_amount
- fix_plan`,
        response_json_schema: {
          type: 'object', properties: {
            leakage_cases: { type: 'array', items: { type: 'string' } },
            missed_billing_patterns: { type: 'array', items: { type: 'string' } },
            failed_collection_patterns: { type: 'array', items: { type: 'string' } },
            estimated_leakage_amount: { type: 'number' },
            fix_plan: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }
        if (action === 'internal_controls_monitor') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Review internal financial controls and segregation-of-duties posture.
Control context: ${JSON.stringify(payload.controls || {})}
Approval logs: ${JSON.stringify(payload.approvals || [])}

Return:
- control_gaps
- severity_matrix
- remediation_actions
- policy_updates
- sentinel_alerts_needed`,
        response_json_schema: {
          type: 'object', properties: {
            control_gaps: { type: 'array', items: { type: 'string' } },
            severity_matrix: { type: 'array', items: { type: 'string' } },
            remediation_actions: { type: 'array', items: { type: 'string' } },
            policy_updates: { type: 'array', items: { type: 'string' } },
            sentinel_alerts_needed: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }
        if (action === 'board_deck_briefing') {
      const snapshots = await base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 12);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Prepare a board-ready finance briefing narrative.
Snapshots: ${JSON.stringify(snapshots.slice(0, 8))}
Board focus: ${payload.board_focus || 'growth efficiency and runway'}

Return:
- narrative_summary
- slide_outline
- key_charts
- decision_requests
- risks_and_mitigations`,
        response_json_schema: {
          type: 'object', properties: {
            narrative_summary: { type: 'string' },
            slide_outline: { type: 'array', items: { type: 'string' } },
            key_charts: { type: 'array', items: { type: 'string' } },
            decision_requests: { type: 'array', items: { type: 'string' } },
            risks_and_mitigations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'centsible_connector_register_secret_refs') {
      const refs = payload.secret_refs || {};
      const normalized = {
        api_key_secret_name: String(refs.api_key_secret_name || ''),
        client_secret_name: String(refs.client_secret_name || ''),
        refresh_token_secret_name: String(refs.refresh_token_secret_name || ''),
      };

      const required = Object.values(normalized).filter((v) => String(v || '').trim().length > 0);
      if (required.length === 0) {
        return Response.json({ error: 'At least one secret reference is required' }, { status: 400 });
      }

      const existing = await base44.asServiceRole.entities.Integration.filter({ name: 'Centsible Finance Connector' }).catch(() => []);
      const row = Array.isArray(existing) ? existing[0] : null;
      if (!row?.id) {
        return Response.json({ error: 'Save connector settings before registering secret refs' }, { status: 400 });
      }

      const cfg = row.api_config || {};
      await base44.asServiceRole.entities.Integration.update(row.id, {
        api_config: { ...cfg, secret_refs: normalized },
        credentials_required: required,
      }).catch(() => null);

      result = { secret_refs: normalized, credentials_required: required };
    }

    if (action === 'centsible_connector_save') {
      const connector = payload.connector || {};
      const provider = String(connector.provider || 'quickbooks').toLowerCase();
      const record = {
        provider,
        auth_type: String(connector.auth_type || 'oauth2'),
        account_label: String(connector.account_label || ''),
        tenant_id: String(connector.tenant_id || ''),
        realm_id: String(connector.realm_id || ''),
        api_base_url: String(connector.api_base_url || ''),
        client_id: String(connector.client_id || ''),
        api_key_secret_name: String(connector.api_key_secret_name || ''),
        client_secret_name: String(connector.client_secret_name || ''),
        refresh_token_secret_name: String(connector.refresh_token_secret_name || ''),
        secret_refs: {
          api_key_secret_name: String(connector.api_key_secret_name || ''),
          client_secret_name: String(connector.client_secret_name || ''),
          refresh_token_secret_name: String(connector.refresh_token_secret_name || ''),
        },
      };

      const existing = await base44.asServiceRole.entities.Integration.filter({ name: 'Centsible Finance Connector' }).catch(() => []);
      let saved = null;

      if (Array.isArray(existing) && existing[0]?.id) {
        saved = await base44.asServiceRole.entities.Integration.update(existing[0].id, {
          description: `Centsible finance connector (${provider})`,
          category: 'finance',
          status: 'disconnected',
          function_name: 'centsibleFinanceEngine',
          integration_type: 'custom',
          api_config: record,
          icon_name: 'DollarSign',
          credentials_required: Object.values((record as any).secret_refs || {}).filter((v) => String(v || '').trim().length > 0),
        }).catch(() => null);
      } else {
        saved = await base44.asServiceRole.entities.Integration.create({
          name: 'Centsible Finance Connector',
          description: `Centsible finance connector (${provider})`,
          category: 'finance',
          status: 'disconnected',
          function_name: 'centsibleFinanceEngine',
          integration_type: 'custom',
          api_config: record,
          icon_name: 'DollarSign',
          credentials_required: Object.values((record as any).secret_refs || {}).filter((v) => String(v || '').trim().length > 0),
        }).catch(() => null);
      }

      result = { saved: Boolean(saved), connector: { ...record, api_key_secret_name: '', client_secret_name: '', refresh_token_secret_name: '' } };
    }

    if (action === 'centsible_connector_load') {
      const existing = await base44.asServiceRole.entities.Integration.filter({ name: 'Centsible Finance Connector' }).catch(() => []);
      const row = Array.isArray(existing) ? existing[0] : null;

      if (!row?.id) {
        result = { exists: false, connector: null };
      } else {
        const cfg = row.api_config || {};
        const refs = cfg.secret_refs || {};
        result = {
          exists: true,
          connector: {
            provider: String(cfg.provider || ''),
            auth_type: String(cfg.auth_type || ''),
            account_label: String(cfg.account_label || ''),
            tenant_id: String(cfg.tenant_id || ''),
            realm_id: String(cfg.realm_id || ''),
            api_base_url: String(cfg.api_base_url || ''),
            client_id: String(cfg.client_id || ''),
            api_key_secret_name: '',
            client_secret_name: '',
            refresh_token_secret_name: '',
          },
          secret_refs: {
            api_key_secret_name: String(refs.api_key_secret_name || cfg.api_key_secret_name || ''),
            client_secret_name: String(refs.client_secret_name || cfg.client_secret_name || ''),
            refresh_token_secret_name: String(refs.refresh_token_secret_name || cfg.refresh_token_secret_name || ''),
          },
          status: row.status || 'disconnected',
          masked: true,
        };
      }
    }

    if (action === 'centsible_connector_test') {
      const existing = await base44.asServiceRole.entities.Integration.filter({ name: 'Centsible Finance Connector' }).catch(() => []);
      const row = Array.isArray(existing) ? existing[0] : null;

      if (!row?.id) {
        return Response.json({ error: 'Centsible connector is not configured' }, { status: 400 });
      }

      const cfg = row.api_config || {};
      const provider = String(cfg.provider || '').toLowerCase();
      const authType = String(cfg.auth_type || '').toLowerCase();
      const refs = cfg.secret_refs || {};
      const checks = [] as string[];

      if (!provider) checks.push('provider is required');
      if (!cfg.account_label) checks.push('account_label is required');

      if (authType === 'oauth2') {
        if (!cfg.client_id) checks.push('client_id is required for oauth2');
        if (!refs.client_secret_name && !cfg.client_secret_name) checks.push('client_secret_name reference is required for oauth2');
        if (!refs.refresh_token_secret_name && !cfg.refresh_token_secret_name) checks.push('refresh_token_secret_name reference is required for oauth2');
      }

      if (authType === 'api_key') {
        if (!refs.api_key_secret_name && !cfg.api_key_secret_name) checks.push('api_key_secret_name reference is required for api_key auth');
      }

      if (provider === 'quickbooks' && !cfg.realm_id) checks.push('realm_id is required for quickbooks');
      if (provider === 'xero' && !cfg.tenant_id) checks.push('tenant_id is required for xero');

      const connected = checks.length === 0;
      await base44.asServiceRole.entities.Integration.update(row.id, { status: connected ? 'connected' : 'disconnected' }).catch(() => null);

      result = {
        connected,
        provider,
        auth_type: authType,
        checks,
        message: connected ? 'Centsible connector is valid and ready.' : 'Centsible connector missing required fields. See checks.',
      };
    }
    return Response.json({ status: 'centsible_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});









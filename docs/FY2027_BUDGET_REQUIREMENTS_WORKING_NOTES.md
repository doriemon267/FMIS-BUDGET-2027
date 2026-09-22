# FY 2027 Budget Preparation and NEP Requirements

> **Document status:** Working requirements / business discussion notes  
> **Audience:** Product owners, business analysts, developers, QA, and future coding agents  
> **Scope:** Initial Budget Proposal, BRD evaluation and tiering, NEP preparation, Sources and Uses of Funds, CPCS salary adjustments, reports, and Chart of Accounts concerns  
> **Important:** This document organizes raw meeting notes. Items marked **For confirmation** must not be implemented based on assumption alone.

## 1. Purpose

This document converts the FY 2027 budget discussion into structured, agent-readable requirements. It distinguishes among:

- business rules that appeared to be agreed upon;
- requested system and report changes;
- suggestions that still need design decisions; and
- unclear or conflicting statements that require confirmation.

The goal is to let a future agent analyze or implement one requirement at a time without treating every meeting remark as an already approved rule.

## 2. Terminology

| Term | Meaning in this document |
| --- | --- |
| BRD | Budget and Revenue Division or the office responsible for central budget evaluation. Confirm the official expansion. |
| Central Office / CO | Central Office users and processes. |
| CPCS 1 / CPCS 2 | Compensation and Position Classification System salary schedules or phases. Confirm the official labels used by NIA. |
| Initial | Initial Budget Proposal phase. |
| NEP | National Expenditure Program phase. |
| PS | Personnel Services. |
| MOOE | Maintenance and Other Operating Expenses. |
| CO / Capital Outlay | Capital Outlay. Use `Capital Outlay` in the UI when `CO` may be confused with Central Office. |
| Corporate Income | Internally generated or corporate income used as a source of funds. |
| Operating Subsidy | Subsidy used as a source of funds or funding charge. |
| Sources | Sources of Funds, primarily income and subsidy in these notes. |
| Uses | Uses of Funds or the expenses charged against the identified sources. |
| Tier 1 / Tier 2 | Initial-budget allocation classifications used by BRD. Under the requested rule, these do not appear in NEP. |
| OPEX | Operating expenditure/report context. Confirm its exact system definition. |
| JO | Job Order personnel. |
| OEN, Regular, CIS, NIS, SOF | Business abbreviations preserved from the discussion; official meanings and expected calculations must be confirmed. |

## 3. Executive Summary of Requested Direction

1. Every submitted expense must identify how it is funded: **Charge to Income** or **Charge to Subsidy**.
2. Sources and Uses must match. The intended equation is:

   `Total Sources of Funds - Total Uses of Funds = Surplus / (Deficit)`

   The target Surplus / (Deficit) is zero, subject to the special PS rule below.
3. PS may temporarily make the regional position negative when CPCS increments exceed available income. MOOE should not be allowed to create a negative balance.
4. The CPCS 1 salary is the baseline. The CPCS 2 increment or difference is generally charged to income for all permanent employees.
5. Tier 1 and Tier 2 are for the **Initial Budget** phase. The requested NEP format has no Tier 1 or Tier 2; it uses only **Income** and **Subsidy** allocations.
6. BRD evaluation should retain read-only original amounts while allowing evaluators to enter allocations and see running totals and remaining balances.
7. Reports must present Sources and Uses holistically, including income and subsidy together, and must follow the revised FY 2027 consolidated format.

## 4. Functional Requirements

### 4.1 Chart of Accounts and Water-related Fees

#### COA-01 — Water Service Fee classification

The correct Chart of Accounts placement for **Water Service Fee** still needs to be identified. This unresolved classification is preventing some regions from completing their entries or uploads.

#### COA-02 — Water Rights Fee classification

- Coordinate the final classification with Accounting.
- The discussion associates **Water Rights Fee** with **Taxes, Duties, Licenses, Insurance, and Premiums**, but the exact parent and sub-account must be confirmed.
- Taxes-related accounts reportedly already have sub-accounts.
- Regions may initially identify the appropriate charge, but a proper sub-account should be created when an amount is material.

#### COA-03 — Other MOOE sub-accounts

- Items recorded under `Other MOOE` should have a specific sub-account.
- During budget preparation, a region may coordinate with Central Office to request the needed sub-account.
- Further Chart of Accounts refinement may be delivered as a future enhancement, provided current encoding is not blocked.

#### COA-04 — Income Tax Expense

The note says there should be **no Income Tax Expense** in the affected report or format, while the account may still exist in the Chart of Accounts. Confirm the exact screen/report from which it must be excluded.

### 4.2 Funding Source on Every Expense

#### FUND-01 — Required funding-source selection

During regional budget submission, each applicable expense or use must have an editable funding-source selection:

- `Charge to Income`; or
- `Charge to Subsidy`.

The submitted regional proposal must contain Uses of Funds that account for its declared sources. Missing uses currently cause an unexplained balance.

#### FUND-02 — Source-aware Uses of Funds

- Add the necessary source breakdown to Uses of Funds.
- Present Corporate Income and Operating Subsidy together under the broader label **Sources** or **Sources of Funds**.
- Avoid using `Corporate Income` as the only top-level heading because subsidy must be represented alongside income.
- Include an `Operating Subsidy` row/column where required.
- In reports that compare the two funding streams, show **Charge to Income** and **Charge to Subsidy** together.

#### FUND-03 — Matching and balance rules

- Total uses should be fully supported by total sources.
- A proposal that does not match the required total should not be accepted or finalized.
- MOOE must not cause the remaining available source balance to go below zero.
- PS may be allowed to show a negative amount when required CPCS-related charges exceed regional income.
- If income remains after mandatory charges, the region may use the balance for its own proposal, subject to normal budget rules.

> **For confirmation:** Define whether submission is blocked when PS produces an allowed negative balance, or whether the negative value is only an evaluation warning that BRD must resolve.

#### FUND-04 — Holistic budget presentation

Budget evaluation and reporting must show income and subsidy together so reviewers can assess the complete funding position rather than viewing isolated sections.

### 4.3 CPCS and Personnel Services

#### CPCS-01 — CPCS baseline and increment

- Use CPCS 1 as the salary baseline/reference.
- Compute the CPCS 2 increment as:

  `CPCS 2 salary - CPCS 1 salary = CPCS increment`

- Example: if CPCS 1 is `20,000` and CPCS 2 is `23,000`, the computed CPCS increment is `3,000`.
- The system should identify and display this difference automatically.

#### CPCS-02 — Default charging rule

- The succeeding CPCS increment is generally **Charge to Income**.
- The discussion applies this rule to all permanent employees.
- The CPCS 2 difference should already be reflected as Charge to Income during regional submission, before the remaining PS budget is allocated.
- If a future CPCS 3 is announced, the same Charge to Income principle is expected to continue, but this remains subject to the official pronouncement.

#### CPCS-03 — Employee with multiple salary sources

The system must support a person whose compensation has separate funding sources. Example discussed:

- CPCS increment: `3,000`, charged to income; and
- baseline salary: `30,000`, charged to subsidy.

The employee remains one personnel record, but the compensation breakdown must preserve both components and their funding sources.

#### CPCS-04 — Salary reference table

- Provide a reference table or selectable salary mapping for permanent employees.
- Include all permanent employees in the applicable table(s).
- The notes mention “two tables for permanent employees,” but the intended split is unclear and must be confirmed before data modeling.

#### CPCS-05 — PS priority and negative position

- Give PS, particularly the CPCS 2 increment, priority in the use of corporate income.
- Deduct the CPCS increment from income before budgeting discretionary items.
- Allow the regional/BRD view to display a negative balance when available income cannot cover the required PS charge.
- Any excess Charge to Income requirement should remain visible during BRD evaluation instead of being silently reclassified.

#### CPCS-06 — Non-permanent personnel / JO

Provide a way to select or identify JO personnel who are entitled to the referenced `10%` benefit or adjustment.

> **For confirmation:** Identify the benefit, legal basis, eligibility rule, computation base, and effective date for the 10% JO entitlement.

#### CPCS-07 — Effective period

The CPCS 2 change was described as newly effective “this July.” Record the official effective date and applicable fiscal-year proration rule before implementation.

### 4.4 Editable Personnel Benefits

#### BEN-01 — Earned Leaves

- Default Earned Leaves computation: `30 days × 0.0481927`.
- Allow the Earned Leaves value to be edited when the budget cannot support the default.
- The UI requires two Earned Leaves fields, but their names and purposes must be confirmed.

#### BEN-02 — Provident Fund

`Provident Fund 3` should be editable.

> **For confirmation:** Confirm whether `3` is a percent, tier/type, account name, or field label, and define its validation limits.

### 4.5 Initial Budget, Tiering, and BRD Evaluation

#### TIER-01 — Initial Budget only

- Tier 1 and Tier 2 apply to the Initial Budget Proposal.
- BRD can evaluate a finalized regional proposal and assign amounts to Tier 1 and Tier 2.
- A proposal may be finalized using only Tier 1, with no Tier 2 amount.
- A reduction may be represented directly (example from the discussion: `100` reduced to `50`) without requiring a Tier 2 allocation.

#### TIER-02 — Per-item allocation and total validation

- Tier allocation is per item and per region.
- The sum of the applicable allocations must match the required proposal/source total.
- Reject save/finalization when the allocation total does not match.

#### TIER-03 — Difference handling

Suggested user-friendly behavior: when BRD reduces Tier 1, automatically place the difference in Tier 2.

> **Status:** Design suggestion only. The meeting explicitly noted that this does not currently happen and still needs consideration. Confirm whether the transfer should be automatic, optional, or manual.

#### TIER-04 — Finalized result reflected to region

The allocation finalized by BRD must be the same allocation visible to the concerned region.

#### EVAL-01 — Original versus allocated amount

During region-by-region evaluation, show:

- the original submitted amount as read-only;
- editable allocation fields;
- totals for PS, MOOE, and Capital Outlay;
- a running allocated total; and
- the remaining amount/balance while the evaluator edits.

The original per-expense amount must remain visible after adjustment and must not be editable in the evaluation/NEP reference view.

#### EVAL-02 — Region-specific editing

Edits apply only to the region currently being evaluated. A single action must not modify every region.

#### EVAL-03 — Large-table usability

For long and wide evaluation tables:

- allow horizontal and/or vertical scrolling;
- consider hide/show column controls;
- allow movement between logical tabs or sections;
- allow insertion/viewing of a breakdown when needed; and
- keep totals visible or easily accessible.

Regions/evaluators must also be able to download the data to Excel.

### 4.6 NEP Workflow and Ceiling

#### NEP-01 — Prerequisite

The Initial regional proposal must be finalized before BRD prepares/finalizes the NEP-related allocations and ceilings. Region 1 was proposed as the first end-to-end case to finalize step by step.

#### NEP-02 — No Tier 1 or Tier 2 in NEP

The requested target behavior is:

- **Initial Budget:** has Tier 1 and Tier 2;
- **NEP:** has no Tier 1 or Tier 2; and
- **NEP allocation columns:** Income and Subsidy only.

This requirement conflicts with the current repository documentation and UI, which still describe or expose NEP Tier Adjustment. Treat this as a requested business-rule change requiring impact analysis and migration planning.

#### NEP-03 — Preserve Initial reference amounts

When creating or editing NEP:

- retain the original Initial amount per expense as read-only reference;
- change only the allowed NEP totals/allocations;
- show separate Income and Subsidy values; and
- do not display Tier fields.

#### NEP-04 — Ceiling breakdown

- NEP Ceiling must support Income and Subsidy separately.
- The ceiling must still be allocated or broken down by expense, not stored only as a single undifferentiated regional total.
- A designated analyst may assign ceilings, provided the role has explicit ceiling-management permission.
- The system should prevent NEP amounts from exceeding the approved ceiling and should validate the complete source/use total.

> **For confirmation:** Define the exact ceiling hierarchy: region, department, division, expense, funding source, or a combination of these.

#### NEP-05 — Workflow through regional department

Projects or proposals sourced from SOF must still pass through the appropriate regional department before integration into FMIS.

> **For confirmation:** Define `SOF` here and identify the source system, ownership, identifiers, and approval statuses that FMIS must consume.

### 4.7 Reports and FY 2027 Consolidated Format

#### RPT-01 — Combined Income and Subsidy report

- Provide a report/page that presents Charge to Income and Charge to Subsidy together for OPEX.
- Support evaluation region by region.
- Use the heading **Sources** or **Sources of Funds**, with Corporate Income and Operating Subsidy shown as components.
- Add a Projected Income column to the Comprehensive Report PDF preview.

#### RPT-02 — Itemization and display

- Do not show unnecessary itemized detail when only totals are required.
- Hide, rather than permanently delete, itemized columns/data unless the business owner explicitly approves removal.
- Preserve drill-down or breakdown capability for reviewers who need it.

#### RPT-03 — Consolidated Proposed Budget for FY 2027

Apply the following requested format changes:

- consolidate **three regions instead of four**;
- after `Budgetary Support`, show the required budgetary-support entry/total;
- show `Total Sources of Funds`;
- show `Total Capital Outlay`;
- show `Total Uses of Funds`;
- remove `Total Current Operating Expenditures (PS + MOOE)`;
- compute `Surplus / (Deficit)` as `Sources less Uses`;
- target `Surplus / (Deficit) = 0`;
- exclude `Semi-Expendable` from Capital Outlay;
- retain `Machinery and Equipment` under the appropriate Capital Outlay section; and
- follow the Central Office format as the presentation reference.

> **For confirmation:** Identify the three included regions and the region to exclude.

#### RPT-04 — MOOE labels and totals

The raw notes contain two statements that need reconciliation:

1. “No OEN and Regular in MOOE.”
2. “Regular and OEN are the total MOOE,” with a separate reference to “CIS and NIS MOOE for OEN Cost.”

Do not change the report formula until the business owner provides the intended row hierarchy and equations for Regular, OEN, CIS, and NIS.

#### RPT-05 — Source availability in reports

The current report reportedly lacks Sources. Add the source breakdown needed to explain how each use is funded and why a balance exists.

### 4.8 Integration and Test Data

#### INT-01 — NIA account / Single Sign-On

When Single Sign-On is implemented, use the authenticated NIA account as the automatic user identity. Do not require duplicate manual identity selection when the SSO identity and organizational assignment are available.

#### INT-02 — Central Office inclusion

Include Central Office in the Initial Budget Proposal flow and relevant consolidated views.

#### INT-03 — Initial phase without complete personnel data

Initial Budget Proposal testing may proceed before the complete personnel roster is final. Use clearly identified dummy/test personnel data only in non-production environments.

#### INT-04 — Missing birthdays for PS testing

Some personnel records may need placeholder birthdays to exercise PS calculations during testing.

> **Data safety rule:** Never silently invent or persist fake birthdays in production. Test placeholders must be labeled, isolated from production, and replaced before go-live.

## 5. Cross-cutting Validation Rules

| ID | Rule | Expected behavior |
| --- | --- | --- |
| VAL-01 | Funding source required | An applicable expense cannot be submitted without Income/Subsidy charging information. |
| VAL-02 | Sources versus Uses | Show a live computed difference between Total Sources and Total Uses. |
| VAL-03 | Balanced final proposal | Finalization normally requires Surplus / (Deficit) to equal zero. |
| VAL-04 | PS negative exception | A negative position caused by mandatory PS/CPCS charges may be displayed, subject to confirmation of submission behavior. |
| VAL-05 | MOOE cannot overdraw | MOOE must not make the available source balance negative. |
| VAL-06 | Initial tier total | Initial Tier allocations must match the required proposal total before finalization. |
| VAL-07 | NEP ceiling | NEP expense/source allocations must not exceed the approved ceiling. |
| VAL-08 | Original amount integrity | Original submitted/Initial amounts shown for comparison are read-only. |
| VAL-09 | Region isolation | Editing one region cannot mutate another region's proposal. |
| VAL-10 | CPCS traceability | Store/display baseline, new salary, difference, and funding source separately. |

## 6. Suggested Screen Behavior

### 6.1 Regional submission

For every applicable PS/MOOE/Capital Outlay entry, display:

- original/requested amount;
- Charge to Income amount;
- Charge to Subsidy amount;
- row total; and
- validation status.

At the bottom or in a sticky summary, display:

- Total Income;
- Total Subsidy;
- Total Sources;
- Total PS;
- Total MOOE;
- Total Capital Outlay;
- Total Uses; and
- Surplus / (Deficit).

### 6.2 BRD Initial evaluation

Display the original regional amount as read-only beside editable Tier 1 and Tier 2 allocations. Show live totals and remaining balances. Support a valid Tier-1-only result.

### 6.3 NEP preparation

Display the original Initial amount as read-only beside editable Income and Subsidy allocations. Do not show Tier 1 or Tier 2. Validate each expense and the overall proposal against the applicable NEP ceiling.

## 7. Acceptance Scenarios

### Scenario A — CPCS split funding

Given a permanent employee has a CPCS 1 baseline of `30,000` and a CPCS 2 increment of `3,000`, when the proposal is prepared, then the system can record `30,000` as Charge to Subsidy and `3,000` as Charge to Income while retaining one employee record and a total PS amount of `33,000`.

### Scenario B — Allowed PS shortfall

Given a region's available income is lower than its mandatory CPCS 2 increments, when PS is computed, then the system displays the resulting negative income position and does not silently move the shortfall to subsidy.

### Scenario C — Prevent MOOE over-allocation

Given the available funding-source balance is zero, when a user adds another MOOE charge, then the system blocks the save/submission or requires a valid alternate funding source; it must not permit a negative balance caused by MOOE.

### Scenario D — Initial proposal without Tier 2

Given BRD is evaluating an Initial proposal, when all approved amounts are assigned to Tier 1 and Tier 2 is zero, then the system accepts the allocation if all required totals match.

### Scenario E — NEP without tiers

Given a finalized Initial proposal and an approved NEP ceiling, when an NEP proposal is prepared, then the screen shows read-only original expense amounts plus Income and Subsidy allocations, and it shows no Tier 1 or Tier 2 fields.

### Scenario F — Balanced Sources and Uses

Given Total Sources are `1,000,000`, when Total Uses are also `1,000,000`, then Surplus / (Deficit) is zero and the balance validation passes.

### Scenario G — Region isolation

Given BRD is editing Region 1, when an allocation is changed and saved, then proposals and allocations belonging to every other region remain unchanged.

## 8. Open Questions Requiring Business Confirmation

1. What exact Chart of Accounts code and hierarchy should contain Water Service Fee and Water Rights Fee?
2. Is Water Rights Fee under Taxes and Duties, Licenses, Insurance and Premiums, or another official account?
3. What are the official definitions of BRD, SOF, OEN, CIS, and NIS for labels and calculations?
4. Which three regions belong in the FY 2027 consolidated report?
5. What exact MOOE row hierarchy and formula should be used for Regular, OEN, CIS, and NIS?
6. What are the two required Earned Leaves fields?
7. What does `Provident Fund 3` mean, and what edit limits apply?
8. Which JO personnel are entitled to 10%, and how is it computed?
9. What is the official CPCS 2 effective date and proration rule?
10. Can a proposal with a permitted PS negative balance be submitted/finalized, or must BRD resolve it first?
11. When Tier 1 is reduced, should the difference automatically transfer to Tier 2, transfer only after confirmation, or remain manual?
12. What is the exact NEP ceiling hierarchy and which roles may edit, publish, and finalize it?
13. In which report/screen must Income Tax Expense be hidden?
14. Should `Total Budgetary Support` be a computed line, a manually entered amount, or both?
15. Which existing itemized data should merely be hidden, and which data should stop being collected entirely?

## 9. Implementation Guidance for Future Agents

1. Treat this file as a working specification, not proof that the current system already implements these rules.
2. Before editing code, compare each requirement with the current models, validators, API contracts, calculations, UI tables, exports, and PDF reports.
3. Pay special attention to the requested removal of Tier fields from NEP. Current repository documentation and components still associate tiering with NEP, so this may require coordinated frontend, backend, report, migration, and test changes.
4. Preserve historical Initial/Tier data even if the NEP UI no longer displays tiers.
5. Use decimal-safe financial calculations and verify rounding rules with Accounting.
6. Add or update tests for calculation rules, workflow transitions, region isolation, ceiling validation, export totals, and report rendering.
7. Do not implement any item marked **For confirmation** until the business answer is recorded in this document or another authoritative decision record.

## 10. Traceability to the Raw Discussion

The raw discussion has been normalized rather than copied verbatim. Its topics are covered as follows:

| Raw discussion topic | Requirement sections |
| --- | --- |
| Water Service Fee, Water Rights, Taxes/Duties, sub-accounts | 4.1 |
| Charge to Income/Subsidy and matching Sources/Uses | 4.2, 5, 6.1 |
| CPCS 1/CPCS 2 salary differences and negative PS | 4.3, 7A–7C |
| Earned Leaves and Provident Fund | 4.4 |
| Tier 1/Tier 2 evaluation and original amounts | 4.5, 6.2 |
| NEP without tiers and expense-level ceilings | 4.6, 6.3, 7E |
| Comprehensive PDF and consolidated FY 2027 report | 4.7 |
| SSO, Central Office, dummy personnel, birthdays | 4.8 |


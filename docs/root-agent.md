# Root Agent for the Custom E-commerce Platform

A root agent that combines `plan.md` (the 43-item implementation plan) with the project decisions notes, and alerts when something is missed or forgotten.

## What the root agent does

Each time a decision is added or the plan changes, the agent checks the two files against each other and returns four lists:

1. **Covered:** decisions that already have a plan item.
2. **Missing from the plan:** decisions with no matching item.
3. **Conflicts:** two decisions, or a decision and a plan item, that contradict each other.
4. **Open decisions:** things the plan needs that have not been decided yet.

The agent can only alert while you are chatting in this project. It cannot message you on its own. For proactive alerts, a scheduled script (for example Claude Code or a GitHub Action calling the API) could run the same check and send an email.

## First run: findings

### Missing from the plan

- **Client onboarding:** creating a new client's database, running migrations, seeding, and setting up their R2 bucket. Items 3 and 7 cover only pieces of this.
- **Super-admin tooling:** a super-admin runs migrations and rollbacks, but no item builds a CLI or screen for it. The role is also not in the roles list (owner, manager, staff, support).
- **R2 credentials:** item 27 (settings) lists payment, courier and notification keys but not the client's R2 keys.
- **Process for new API versions:** "a new client request creates a new API version" has no item, such as contract tests or a versioning checklist.

### Conflict to confirm

- The API runs on a shared VPS, and PostgreSQL and all resources also run on the client's hosting. Does the shared API connect to each client's remote database? This affects item 3, security (item 40) and latency.

### Open decisions

- SMS and email providers (item 19 needs them).
- Delivery charges, for example inside Dhaka versus outside.
- Cancellations, returns and refunds.
- Coupons and discounts.
- Customer notifications for each order status change.

None of the open decisions is in the notes or the plan. Some may be out of scope for v1 and can be dropped.

## Next step

Write the agent as a `root-agent.md` instruction file containing its role, the two files it reads, the four-list output format, and a short checklist. Paste it into this project's instructions so it runs every time work happens here.

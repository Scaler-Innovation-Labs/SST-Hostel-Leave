@AGENTS.md


You are a Senior Software Architect working on SST Hostel Leave System.

Before generating code:

1. Read and follow:
   - AGENTS.md
   - docs/architecture/system-overview.md
   - docs/architecture/engineering-rules.md
   - docs/architecture/domain-rules.md
   - docs/architecture/backend-development-workflow.md
   - docs/architecture/code-review-checklist.md

2. Follow all architectural rules strictly.

3. Never generate code that violates layer boundaries.

Required architecture:

Route
→ DTO Validation
→ Service
→ Repository
→ Database

Forbidden:

Route → Repository
Route → Database
Repository → Service
Service → UI

--------------------------------------------------

Before writing any code:

1. Identify the domain.
2. Identify the architectural layer.
3. Search the existing codebase.
4. Reuse existing implementations where possible.
5. Explain where the new code belongs and why.

--------------------------------------------------

Naming Rules

Folders:
kebab-case

Files:
kebab-case

Components:
PascalCase

Hooks:
camelCase

Types:
PascalCase

Variables:
camelCase

Constants:
SCREAMING_SNAKE_CASE

Database:
snake_case

--------------------------------------------------

Repository Rules

Repositories are persistence only.

Allowed:
- select
- insert
- update
- delete

Forbidden:
- workflows
- notifications
- approvals
- policy evaluation
- QR generation

--------------------------------------------------

Service Rules

Services own:
- workflows
- approvals
- notifications
- policy enforcement
- QR generation
- movement coordination

Services orchestrate repositories.

--------------------------------------------------

Business Rules

Leave approval != movement.

Leave = permission.

Movement = reality.

Never merge the two.

Leave extensions are not new leave requests.

Use:
leave_extensions

Never create a new leave request for an extension.

Approval workflows must always come from:
workflow_definitions and workflow_steps

Never hardcode approval chains.

Parents are not authenticated users.

QR payloads must contain:
- token
- identifier

only.

Movement history comes from:
movement_events

--------------------------------------------------

Code Generation Rules

Always:

- use strict TypeScript
- use type imports
- use Zod DTOs
- use domain errors
- use repository pattern
- use service layer
- use response helpers
- use existing constants

Never:

- use any
- use generic Error
- duplicate logic
- create giant files
- hardcode workflows
- bypass architecture

--------------------------------------------------

When generating code:

1. Explain the design.
2. Explain ownership.
3. Explain file placement.
4. Explain why this follows architecture.
5. Then generate code.

When refactoring:

1. Preserve behavior.
2. Reduce complexity.
3. Improve architecture.
4. Remove duplication.
5. Keep existing conventions.

Act as a senior engineer reviewing code for long-term maintainability, not as a code generator.






---



Review this codebase as a Staff Engineer.

Check:

- Architecture violations
- Layer violations
- Domain ownership issues
- Naming violations
- Security issues
- Missing authorization
- Missing validation
- Missing audit logging
- Missing notifications
- Business rule violations
- Duplication
- Performance concerns
- Type safety issues

For every issue provide:

Severity:
- Critical
- High
- Medium
- Low

Explain:

- Why it is a problem
- Evidence from code
- Recommended fix

Do not praise code.

Focus on finding weaknesses.




---



Refactor the codebase based on what u found according to AGENTS.md and architecture documentation.

Goals:

- Preserve behavior
- Improve maintainability
- Improve separation of concerns
- Remove duplication
- Improve naming
- Improve type safety
- Follow Route → DTO → Service → Repository → Database

Before refactoring think of:

current issues.
proposed architecture.
file moves if required.

Then start implementation.


//prompt


Yes. Your current prompt is making Copilot:

```text
Read 6 docs
Analyze architecture
Explain ownership
Explain design
Explain placement
Explain why
Generate code
Review itself
```

every single time.

That's expensive in tokens and often makes Copilot spend more time explaining than coding.

For day-to-day development, use a **compact implementation prompt**.

---

# Feature Implementation Prompt (Fast)

```md
Follow:

AGENTS.md
.github/copilot-instructions.md

Architecture:

Route
→ DTO
→ Service
→ Repository
→ Database

Rules:

- No any
- No hardcoded statuses
- No hardcoded approval sources
- Use existing constants
- Use existing schema
- Use existing response helpers
- Use existing errors
- Use @/ imports
- No business logic in repositories
- No database queries in routes
- No workflow logic in routes
- No duplicate code

Task:

Implement <FILE_NAME> only.

Output:

1. Missing dependencies (if any)
2. Code

Do not explain architecture.
Do not explain ownership.
Do not generate unrelated files.
```

---

# Repository Prompt

Use for repositories.

```md
Follow AGENTS.md.

Implement:

<repository-file>

Repository responsibilities only:

- select
- insert
- update
- delete

Do NOT add:

- workflows
- notifications
- policy evaluation
- approval logic

Requirements:

<methods>

Return typed results.

No any.

Output code only.
```

Example:

```md
Implement:

src/db/repositories/leave/leave-type.repository.ts

Methods:

findById(id)
findByCode(code)

Output code only.
```

---

# Service Prompt

```md
Follow AGENTS.md.

Implement:

<service-file>

Service responsibilities:

- orchestrate repositories
- business rules
- transactions

Do NOT implement:

- notifications
- audit
- QR
- movement

unless explicitly required.

Requirements:

<requirements>

Use existing repositories.

No any.

Output:

1. Missing dependencies
2. Code
```

Example:

```md
Implement:

src/services/leave/create-leave.service.ts

Requirements:

- load student from current user
- load leave type
- validate leave type exists
- check overlapping leaves
- create leave request
- create approval records
- use transaction

No notifications.
No audit.
No QR.

Output code only.
```

---

# Review Prompt (Most Important)

This saves the most tokens.

```md
Review this code.

Only report:

Critical
High
Medium

Format:

[Severity]
Issue
Why
Fix

Do not explain architecture.
Do not praise code.
Do not rewrite code.
Be concise.
```

This reduces reviews from:

```text
2000 tokens
```

to

```text
300-500 tokens
```

---

# Refactor Prompt

```md
Refactor this code.

Goals:

- remove any
- improve typing
- remove duplication
- follow AGENTS.md

Preserve behavior.

Output:

1. Issues found
2. Refactored code

Be concise.
```

---


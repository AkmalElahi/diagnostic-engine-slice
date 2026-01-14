# HANDOFF.md - RV Diagnostic Engine Milestone 2

## Final Deliverable

**Commit Hash:** `2b9e969a8d064fa1bc52b5d79adbeafb96eeac7b`

**Repository:** `https://github.com/AkmalElahi/diagnostic-engine-slice`

**Milestone:** Hardened Deterministic Engine with Schema Validation

---

## Quick Start Verification

### 1. Install & Build
```bash
npm install
npx expo prebuild
npx expo run:ios    # or npx expo run:android
```

### 2. Run Verification Tests

**Option A: Automated (Console)**
```typescript
// Add to App.tsx temporarily:
import { demonstrateDeterminism } from './src/tests/determinism-demo';
import { demonstrateValidation } from './src/tests/validation-demo';

useEffect(() => {
  setTimeout(() => {
    demonstrateDeterminism();
    demonstrateValidation();
  }, 1000);
}, []);
```

**Manual Resume Test**
1. Launch app
2. Start diagnostic → Answer 2 questions
3. Force quit (swipe away, not background)
4. Relaunch app
5. Should resume at step 3 with all data intact

### Expected Pass Results

**Determinism:** `✅ PASS: DETERMINISTIC ENGINE CONFIRMED`
**Validation:** `✅ ALL VALIDATION TESTS PASSED (6/6)`
**Resume:** `✅ PASS: Resume then complete produces same summary as clean run`

---

## System Architecture Boundaries

### IMMUTABLE CORE (Engine - Do Not Modify)

These components define **HOW diagnostics work** and should be treated as **locked infrastructure**:

#### **Critical - Breaking Changes Here Break Everything:**

1. **src/utils/flowEngine.ts**
   - Flow execution logic
   - Node navigation algorithm
   - Event recording
   - Session state management
   - **Why Locked:** Changing behavior breaks determinism and invalidates all existing flow JSONs

2. **src/utils/flowValidator.ts**
   - Schema validation rules
   - Node type definitions
   - Reference integrity checking
   - **Why Locked:** Changing validation rules could allow invalid flows or reject valid ones

3. **src/utils/StorageService.ts**
   - MMKV persistence layer
   - Storage keys and format
   - Session state serialization
   - **Why Locked:** Changing storage format breaks resume-after-kill and corrupts existing sessions

4. **src/types.ts (Core Types)**
   - `FlowDefinition`
   - `SessionState`
   - `SessionEvent`
   - `SessionSummary`
   - Node type interfaces
   - **Why Locked:** Type changes break serialization, validation, and determinism

#### **Safe to Extend (But Not Modify):**

5. **Node Type System**
   - ✅ Adding NEW node types: Safe (e.g., CALCULATION, CONDITIONAL)
   - ❌ Changing EXISTING node types: DANGEROUS (breaks all flows using them)
   - **Rule:** Extension = OK, Modification = NO

---

### FLEXIBLE CONTENT (Diagnostic Content - Safe to Change)

These components define **WHAT diagnostics say** and should be frequently updated:

1. **Flow JSON Files**
   - `/src/flows/*.json`
   - Node text and copy
   - Flow structure and branching
   - **Safe Changes:** All text, node connections, flow logic

2. **UI Components**
   - QuestionNodeComponent.tsx
   - SafetyNodeComponent.tsx
   - MeasureNodeComponent.tsx
   - TerminalNodeComponent.tsx
   - **Safe Changes:** Styling, layout, animations, copy

3. **App Shell**
   - FlowSelector.tsx
   - HistoryView.tsx
   - App.tsx (navigation/routing)
   - **Safe Changes:** Navigation flow, UI/UX improvements

4. **Error Messages**
   - User-facing error text
   - Alert messages
   - Validation error descriptions
   - **Safe Changes:** Wording, clarity, translations

---

## Guarding Against Engine Drift

### The Problem: Why Engine Changes Are Dangerous

**Once flows are deployed, the engine becomes infrastructure:**

```
┌─────────────────────────────────────┐
│  100+ Flow JSONs in Production      │
│  (Authored by non-engineers)        │
└─────────────────┬───────────────────┘
                  │
                  │ All depend on
                  ▼
┌─────────────────────────────────────┐
│         Flow Engine                 │
│  "If I change this, do all         │
│   flows still work?"               │
└─────────────────────────────────────┘
```

**Changing the engine means:**
- ❌ Re-testing every single flow
- ❌ Potential breaking changes to deployed diagnostics
- ❌ Sessions in storage may become incompatible
- ❌ Summaries from before/after change can't be compared
- ❌ Determinism guarantees broken

### Guard Rails: How to Prevent Drift

#### 1. **Treat Engine as a Black Box**

```
┌──────────────────────────────────────┐
│         DIAGNOSTIC ENGINE            │
│                                      │
│  Input:  Flow JSON                   │
│  Output: Session Summary             │
│                                      │
│  [DO NOT OPEN]                       │
└──────────────────────────────────────┘
```

**Rule:** If you need to understand engine internals to build a diagnostic, something is wrong.

#### 2. **"Can This Be Solved with JSON?" Test**

Before changing engine, ask:

❓ **Question:** "I need a node that calculates BMI from weight/height inputs"

🚫 **Wrong Answer:** Modify flowEngine.ts to add calculation logic

✅ **Right Answer:** Add a new `CALCULATION` node type to the engine once, then all future calculations use JSON:

```json
{
  "type": "CALCULATION",
  "formula": "weight / (height * height)",
  "result_to": "bmi_value"
}
```

**Principle:** Solve the **class of problems**, not the **specific problem**.

#### 3. **Version the Flow Schema**

```json
{
  "flow_schema_version": "1.0",  // Add this to every flow
  "flow_id": "diagnostic_xyz",
  "flow_version": "2.3"
}
```

If engine changes are unavoidable:
- Bump schema version: `1.0` → `2.0`
- Keep old engine for old flows
- Migration tool to upgrade flows
- Never break backward compatibility silently

#### 4. **Red Flags: Signs You're Drifting**

🚩 "Just a quick fix to the engine..."
🚩 "This flow needs special handling..."
🚩 "Let me add a flag to this node type..."
🚩 "I'll just modify processResponse() slightly..."

**These are symptoms that either:**
- The engine is incomplete (missing node type)
- The diagnostic design is wrong (should be restructured)
- You're solving a content problem with an infrastructure change

#### 5. **Safe Extension Pattern**

**Adding New Node Types (Safe):**

```typescript
// ✅ SAFE: Adds capability without changing existing behavior
interface CalculationNode {
  type: 'CALCULATION';  // NEW type
  formula: string;
  next: string;
}

// Existing node types unchanged ✓
```

**Modifying Existing Node Types (DANGEROUS):**

```typescript
// ❌ DANGEROUS: Changes existing behavior
interface QuestionNode {
  type: 'QUESTION';
  text: string;
  yes: string;
  no: string;
  allow_maybe?: boolean;  // ← This breaks all existing flows!
}
```

**Enforcement:**
- Flow authors edit JSON only
- FlowValidator blocks invalid flows
- No direct access to engine code
- If JSON can't express something → Feature request, not hack

---

### When Engine Changes ARE Necessary

**Acceptable reasons (rare):**
- ✅ Critical bug fix (determinism broken)
- ✅ Security vulnerability
- ✅ Adding completely new node type (extension)
- ✅ Performance optimization (preserving behavior)

**Unacceptable reasons (common temptations):**
- ❌ "This one flow needs special behavior"
- ❌ "Quick fix for edge case"
- ❌ "Making the API more convenient"
- ❌ "Refactoring to be cleaner"

### Enforcement Strategy

```typescript
// Add to flowEngine.ts header:
/**
 * ⚠️  CRITICAL INFRASTRUCTURE - DO NOT MODIFY
 * 
 * This engine powers 100+ diagnostic flows in production.
 * Changing this file affects EVERY flow and EVERY user.
 * 
 * Before modifying:
 * 1. Can this be solved with a new node type? (Extension OK)
 * 2. Does this change existing node behavior? (Modification DANGEROUS)
 * 3. Have you tested ALL existing flows? (Required)
 * 4. Is there a migration path? (Required)
 * 
 * If unsure, DO NOT MODIFY. Ask first.
 */
```

---

### Working Safely in Phase 3

**Safe Day-to-Day Work:**
```bash
# ✅ Edit flows
vim src/flows/new_diagnostic.json

# ✅ Improve UI
vim src/components/QuestionNodeComponent.tsx

# ✅ Add analytics
vim src/utils/AnalyticsService.ts

# ✅ Update copy
vim App.tsx

# ❌ NEVER do this without team review:
vim src/utils/flowEngine.ts
vim src/utils/flowValidator.ts
vim src/types.ts
```

**Pull Request Red Flags:**
- Any changes to `flowEngine.ts` → Immediate escalation
- Any changes to `types.ts` core interfaces → Architecture review
- Any changes to `flowValidator.ts` → Validation re-run required

---

## Critical Files Reference

### 🔴 Never Touch (Without Architectural Review)
```
src/utils/flowEngine.ts       - Flow execution
src/utils/flowValidator.ts    - Schema validation  
src/utils/StorageService.ts   - Persistence layer
src/types.ts                  - Core type definitions
```

### 🟡 Extend Only (New Features OK, Changes Dangerous)
```
src/types.ts (new node types)  - Add types, don't modify existing
```

### 🟢 Safe to Modify (Content Layer)
```
src/flows/*.json              - Diagnostic flows
src/components/*.tsx          - UI components
App.tsx                       - Navigation/routing
```

---

## Verification Artifacts

### 1. Determinism Proof
**Location:** Console output from `demonstrateDeterminism()`
**Expected:** Two runs with identical inputs produce identical normalized summaries
**Key Indicator:** `✅ PASS: DETERMINISTIC ENGINE CONFIRMED`

### 2. Flow Validation Proof
**Location:** Console output from `demonstrateValidation()`
**Expected:** All 8 invalid flows correctly rejected with specific error messages
**Key Indicator:** `✅ ALL VALIDATION TESTS PASSED (8/8)`

### 3. Resume-After-Kill Proof
**Location:** Console output from `testResumeAfterKill()` + manual testing
**Expected:** Session restored from MMKV with identical state, completes successfully
**Key Indicators:**
- `💾 Session state loaded: session_...`
- `✅ Session resumed: session_...`
- `✅ PASS: Resume-then-complete produces same summary as clean run`

---

## Known Limitations & Future Considerations

### Current Limitations
1. **Single active session** - Can't have multiple diagnostics in progress simultaneously
2. **No session history UI** - History exists in storage but basic display only
3. **No flow versioning UI** - Flows have versions but no upgrade path shown to users
4. **English only** - No i18n/l10n support yet

### Future Engine Extensions (Safe)
- New node types: CONDITIONAL, CALCULATION, LOOP
- Multi-session support
- Flow migration tools
- Schema versioning system

### Future Content Work (Safe)
- Flow library (10-20 diagnostics)
- Flow authoring templates
- Branded UI components
- Field testing feedback

---

## Final Checklist

- [x] Deterministic engine verified
- [x] Flow validation enforced at load time
- [x] Resume-after-kill working correctly
- [x] Schema validation blocks invalid flows
- [x] Error boundaries catch rendering errors
- [x] Storage health check on startup
- [x] Comprehensive type coverage
- [x] No hard-coded diagnostic logic
- [x] All tests documented in README
- [x] Core engine locked and documented

**This milestone delivers a hardened, deterministic, validated diagnostic engine that is now production-ready infrastructure. Treat it as such.**
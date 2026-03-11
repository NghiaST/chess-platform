# Frontend Improvements - Review and Next Update Plan

Date: 2026-03-11
Status: Planning only (no code changes in this step)

## 1) Review of proposed improvements

### A. Settings page and gameplay preferences
Requested:
- Toggle legal move highlight when selecting a piece
- Theme options (background, board, pieces)
- Toggle premove
- Add placeholder for AI move support
- Customize right-click annotation colors

Assessment:
- Strongly recommended. This gives users personalization and creates a stable base for future advanced features.
- Should be implemented as persistent user preferences in frontend first (localStorage), then optional server sync later.
- Theme support is feasible for board + background now.
- Piece sets are possible via `customPieces` in `react-chessboard`, but assets are needed.

Added recommendations:
- Add a settings schema version (for migration of preferences later).
- Add a quick reset button: "Reset to default settings".
- Add import/export JSON for settings (optional, phase 2).

### B. Right-click annotations (circle and arrow)
Requested:
- Right-click single square -> colored circle marker
- Right-drag between squares -> arrow

Assessment:
- Arrow support already exists in library, but color and marker behavior should be controlled by app state.
- Need a unified "annotation model" so circle and arrow are in the same state and can be cleared consistently.

Added recommendations:
- Add hotkey `C` to clear annotations for faster analysis workflow.
- Add option "Show my annotations only" for future multiplayer spectator mode.

### C. Selection behavior when clicking own piece while a piece is selected
Requested:
- If a piece is selected and user clicks another own piece:
  - If move is legal (castling case), execute move.
  - Otherwise switch selection to the new piece.

Assessment:
- Correct UX expectation. Current logic clears selection and does not switch reliably.
- Low risk and should be prioritized early.

Added recommendations:
- Add selected-piece ring + legal targets simultaneously for better clarity.

### D. PvP time control (10 minutes each)
Requested:
- Add 10:00 per side in PvP; flag falls = loss.

Assessment:
- This is not frontend-only; needs authoritative backend clock in Socket.IO game state.
- Frontend should display countdown and local smoothing, but server decides timeout.

Added recommendations:
- Add anti-lag policy: server timestamp + client correction.
- Add disconnect grace policy (example: 30 seconds grace, then loss) as a separate rule decision.

### E. Replay improvements
Requested:
- Play/Pause autoplay
- Better icons instead of text symbols
- Move numbering fix (pair white/black as one turn)

Assessment:
- Fully valid. Current Replay page is minimal and needs this pass.
- Should reuse the same move-pair grouping approach from `MoveHistory`.

Added recommendations:
- Add speed control (0.5x/1x/2x).
- Add "jump to critical positions" hook later when analysis is available.

### F. Win probability bar (white/black advantage)
Requested:
- Vertical white/black bar showing side advantage.

Assessment:
- Good feature, but requires evaluation source (engine score).
- In current phase, add UI placeholder + data contract in settings.

Added recommendations:
- Normalize score to [-1, +1] for rendering.
- Show tooltip with percentage and centipawn/mate score.

### G. Two new modes: Practice and Study
Requested:
- Practice mode:
  - AI move support
  - Undo move
  - (and other useful training features)
- Study mode:
  - User can play both colors
  - AI analysis of best moves
  - Priority arrows for recommended lines
  - UI should be reorganized so analysis is easy to observe

Assessment:
- Excellent direction. These modes solve two different user intents and should be explicit at game creation time.
- Current architecture can support this with mode-aware state and a dedicated analysis panel.

Added recommendations:
- Add mode switch at game start: `practice` | `study` (do not mix rules inside one mode).
- Add optional "coach strictness" in Practice mode:
  - `off` (only suggestions)
  - `warn` (warn on blunders)
  - `block` (disallow move below threshold)
- Add Study quality-of-life features:
  - Free board flip
  - Step backward/forward
  - Branch preview placeholder for future multi-PV lines
- Keep analysis compute asynchronous and cancelable to avoid UI stutter.

## 2) Dependency and feasibility notes

- Piece themes need assets.
- If no piece asset pack is available, ask user to provide source files (SVG/PNG set + licensing).
- PvP clock requires backend socket events and server-side timer state.
- Win probability bar needs analysis feed (engine or remote AI service).
- Practice/Study analysis requires a score provider (local stockfish worker or backend engine API).
- For smooth UX, analysis output should include: `cp`, `mate`, `bestMoves[]`, `pv[]`, `depth`, `timeMs`.

## 3) Proposed implementation phases

## Phase A - UX and local settings (frontend only)
Scope:
- Settings UI page and store
- Persistent preferences (localStorage)
- Legal move highlight toggle
- Selection behavior fix (switch own selected piece)
- Replay UI controls (icons + autoplay + speed)
- Replay move list grouped by turn (white/black)
- Add mode selector UI for future `practice` and `study`

Deliverables:
- `settingsStore` (Zustand persist)
- New `SettingsPage` route
- Updated `ChessBoard` interaction logic
- Updated `ReplayPage` controls and move grouping
- Game creation form stores selected mode in frontend state

## Phase B - Annotation system upgrade (frontend)
Scope:
- Circle markers + arrow annotations + color palette
- Right-click behavior and drag behavior in one controller
- Clear annotation actions

Deliverables:
- Annotation state model and hooks
- Color picker in settings
- Integration with board rendering props

## Phase C - Practice mode (frontend + backend light)
Scope:
- `practice` mode rules and UI
- AI support panel (best move suggestion, short explanation placeholder)
- Undo last move in bot/practice game
- Optional coach warnings before move submission

Deliverables:
- Mode-aware game state (`mode: practice | study | standard`)
- `PracticePanel` component (hint, eval snapshot, coach status)
- `Undo` action flow (frontend + API endpoint guard)
- Settings toggles wired to practice behavior

## Phase D - Study mode + analysis-first layout
Scope:
- `study` mode where user can move both colors
- Analysis panel with best line and candidate moves
- Priority arrows rendered on board from AI suggestions
- Vertical win probability bar integrated near board

Deliverables:
- `StudyPage` (or mode section in `GamePage`)
- Analysis data contract and rendering components
- Arrow rendering model (`suggestionArrows` separate from user annotations)
- Move list synchronized with analysis cursor

## Phase E - PvP chess clock (frontend + backend)
Scope:
- Server authoritative 10+0 clock
- Timeout result handling
- Sync events for reconnect

Deliverables:
- Socket events: `clock:state`, `clock:tick`, `clock:timeout`
- Game result by timeout persisted in DB
- Frontend timers and timeout UI banner

## Phase F - Analysis hardening and performance
Scope:
- Cache analysis by FEN to reduce duplicate compute
- Debounce engine requests while user scrubs replay
- Add failure states and fallback UI

Deliverables:
- Analysis cache policy and invalidation rules
- Worker/API timeout handling
- Monitoring hooks for analysis latency

## 4) Test plan (required)

## Unit tests
- Settings store:
  - default values
  - toggle behavior
  - persistence rehydration
  - schema migration fallback
- Replay helpers:
  - move pairing white/black
  - cursor bounds
  - autoplay tick progression and stop at last move
  - speed switching mid-play keeps stable timing
  - mode-based feature gates (practice/study)
- Board interaction:
  - selecting second own piece switches selection when move is illegal
  - castling legal move still executes
- Annotation model:
  - add/remove circle
  - add/remove arrow
  - color assignment
- Practice helpers:
  - undo stack behavior
  - coach strictness rule evaluation
- Study helpers:
  - convert engine score to win-probability bar percent
  - map `bestMoves` to board arrows

## Component tests (React Testing Library)
- `SettingsPage`:
  - toggles update UI + store
  - reset-to-default works
- `ReplayPage`:
  - play/pause button state
  - speed selector affects interval
  - move list displays paired turns
- `ChessBoard`:
  - right-click adds annotation indicator
  - legal highlight obeys setting
- `PracticePanel`:
  - hint appears when enabled
  - undo button enabled/disabled correctly
- `StudyPanel`:
  - best move list updates when cursor/FEN changes
  - priority arrows toggle works
  - win probability bar reflects score direction

## Integration tests (frontend + mocked socket/api)
- PvP timer display sync with server ticks
- timeout event ends game and shows correct result
- reconnect rehydrates clock state
- Practice mode requests hint + handles undo round-trip
- Study mode consumes analysis payload and renders arrows/bar

## Backend tests (Jest + socket integration)
- clock starts for PvP game
- active-side time decreases only on that side
- timeout emits game ended and saves final status/result
- reconnect receives full clock snapshot
- Practice mode undo endpoint validates game ownership/state
- Analysis endpoint/stream returns required fields and safe limits

## E2E tests (Playwright)
- User opens settings, changes preferences, refreshes page -> preferences persist
- User enters replay, presses Play, auto-advances to end, Pause works
- Replay move table displays turns as `1. e4 e5`, `2. Nf3 Nc6`, etc.
- PvP game timeout scenario (mock fast clock in test env)
- Practice mode: request hint, make move, undo move
- Study mode: play both sides, see arrows and evaluation bar update

## 5) Suggested priority order (next sprint)

1. Phase A (settings core + replay polish + selection behavior + mode selector)
2. Phase B (annotation color and controls)
3. Phase C (practice mode MVP)
4. Phase D (study mode + analysis UI)
5. Phase E (authoritative PvP clock)
6. Phase F (analysis performance hardening)

## 6) Open decisions for user

- Piece theme assets:
  - Provide asset pack now, or keep default pieces first.
- Clock format for PvP:
  - Confirm only 10+0 for now, or support presets (3+0, 5+0, 10+0).
- Timeout rules:
  - Immediate loss on flag fall only, or include disconnect grace rule.
- Advantage source:
  - Local engine in browser, backend engine, or third-party API.
- Mode entrypoint:
  - Separate pages (`/practice`, `/study`) or a unified game page with mode tabs.
- Undo policy in Practice mode:
  - Allow only player last move, or allow full takeback pair (player+bot).
- Coach strictness default:
  - `off`, `warn`, or `block`.

## 7) Definition of done for next update

- Settings page exists and all toggles in Phase A are functional.
- Replay page has autoplay + clean icon controls + correct paired moves.
- Board selection behavior matches chess UX requirement.
- Practice mode supports hint + undo with clear UX.
- Study mode supports two-side play + analysis panel + priority arrows + win probability bar.
- Test coverage added for new settings/replay/board behavior.
- CI tests pass for backend + frontend test suites.

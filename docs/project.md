# Student Report Generator — Project Documentation

**Last updated:** 2026-06-05  
**Status:** Live in production, awaiting teacher feedback for next iteration

---

## What it does

A web tool for teachers to generate professional, personalised student reports using AI. Teachers configure a template, enter student names and grades, and receive a polished 3–4 sentence report per student that follows strict third-person, objective writing rules.

---

## Live URLs

| | URL |
|---|---|
| **Frontend** | https://chriswatson6675.github.io/report-generator/ |
| **Backend API** | https://report-generator-production-29b1.up.railway.app |
| **Health check** | https://report-generator-production-29b1.up.railway.app/health |
| **GitHub repo** | https://github.com/chriswatson6675/report-generator |

---

## Architecture

```
index.html  (static frontend)
    │
    │  POST /generate-report
    ▼
report-generator-server.js  (Express, hosted on Railway)
    │
    │  Anthropic API call
    ▼
Claude Haiku (claude-haiku-4-5-20251001)
```

### Frontend
- Single standalone `index.html` — vanilla JS, no dependencies, no build step
- Hosted on **GitHub Pages** (deploys automatically on push to `main`)
- Calls the Railway backend directly via `API_URL` constant at top of script

### Backend
- **Node.js / Express** server (`report-generator-server.js`)
- Hosted on **Railway** (deploys automatically on push to `main`)
- Two endpoints:
  - `GET /health` — returns `{ status: 'ok', timestamp }` for monitoring
  - `POST /generate-report` — accepts student data, returns AI-generated report
- Uses `claude-haiku-4-5-20251001` model (fast, cost-effective for this use case)

### Environment variables (set in Railway dashboard)
| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `PORT` | Set automatically by Railway — do not override |

---

## File structure

```
report-generator/
├── index.html                  # Complete frontend (HTML + CSS + JS)
├── report-generator-server.js  # Express backend
├── package.json                # Node dependencies: express, cors, dotenv, @anthropic-ai/sdk
├── .env                        # Local dev only — NOT committed to git
├── .gitignore                  # Ignores node_modules/ and .env
└── docs/
    └── project.md              # This file
```

---

## Report templates

### Form Tutor Report
- **Characteristics:** Attendance, Behaviour, Punctuality, Relationships, Wellbeing
- **Tone:** Holistic, pastoral, developmental
- **Special handling:** Punctuality grade maps to specific language in the prompt

### Physics Report
- **Characteristics:** Analytical thinking, Practical skills, Communication, Problem-solving, Collaboration, Engagement
- **Tone:** Academic, technical, skill-focused

Both templates support:
- Custom characteristics (added by teacher)
- Three timing modes: Beginning of year / Mid-year / End of year
- Per-student pronoun selection: M (he/him) / F (she/her)
- Grades 1–5 per characteristic

---

## AI prompt rules (enforced server-side)

The prompt instructs Claude to:
- Write strictly in third person (no I/we/my/our)
- Use the student's first name at least once
- Open with a positive observation
- Address development areas honestly but constructively
- Close with a forward-looking statement
- No bullet points, headers, or preamble
- No first-person phrases, no personal relationship language, no future meeting offers
- No comparisons to other students or previous years

---

## Deployment workflow

```
Edit files locally (C:\projects\report-generator\)
        │
        ▼
Test: open index.html in browser (calls live Railway backend)
        │
        ▼
Tell Claude to push → git commit + git push
        │
        ├──▶ Railway detects push → redeploys backend (~1–2 min)
        └──▶ GitHub Pages detects push → redeploys frontend (~60 sec)
```

**No manual steps required after push.** Both platforms auto-deploy from the `main` branch.

---

## Change history

### 2026-06-04 — Initial build & deployment

- Built Express backend with `/generate-report` and `/health` endpoints
- Built standalone `index.html` frontend with:
  - Template selector (Physics / Form Tutor)
  - CSV upload or paste student names
  - Characteristics editor (preset + custom)
  - Timing selector (beginning / mid / end of year)
  - Gender/pronoun selector per student
  - Grade grid with sliders, sticky headers, keyboard input (1–5 keys, Tab)
  - Report generation with regenerate button
  - Copy to clipboard per report
  - Download all reports as CSV
- Set up GitHub repo (`chriswatson6675/report-generator`)
- Deployed backend to Railway with `ANTHROPIC_API_KEY` environment variable
- Deployed frontend to GitHub Pages

### 2026-06-04 — Template order & branding

- Reordered templates: Form Tutor now first (and default), Physics second
- Changed header text from "Powered by Claude AI" to "Powered by Pixies"

### 2026-06-05 — Full UI redesign

**Color scheme**
- Replaced default blue palette with modern indigo (`#4F46E5`)
- Warm off-white background, soft shadows, consistent border radius

**Typography**
- Added Inter font (Google Fonts)
- Improved hierarchy: step numbers, labels, heading weights

**Header**
- Gradient background (indigo 700 → indigo 500 → indigo 400)
- Icon, title, subtitle, "Powered by Pixies" pill badge

**Option cards (timing + template)**
- CSS grid layout replacing flexbox
- Animated checkmark indicator on selected card
- Emoji icons per option (🌱 📈 🎓 / 👥 ⚗️)
- Hover and active states with glow ring

**Grade grid**
- Custom range input styling — indigo thumb with hover scale
- Grade badges styled as colored pills
- Focus state: active cell and row highlighted in indigo

**Grade colour coding**
- Slider thumb and badge change colour by value:
  - 1 → Red, 2 → Orange, 3 → Blue (indigo), 4 → Purple, 5 → Green
- Implemented via `data-grade` attribute + CSS attribute selectors
- Updates live as sliders are moved

**Report cards**
- Larger border radius, hover shadow lift
- Report text in italic blockquote style with indigo left border

**Beer modal**
- Appears after all reports are generated
- Animated entrance (fade + slide-up with bounce)
- Blurred backdrop overlay
- Message: creator doesn't need thanks, but a cold beer at the weekend wouldn't go unappreciated

---

## Known issues / notes

- `file://` URL security warning appears in browser console — harmless, disappears when accessed via GitHub Pages URL
- CORS is wide open (`app.use(cors())`) — acceptable for a school-internal tool; can be locked to the GitHub Pages domain if needed in future
- The `.env` file is gitignored and must never be committed

---

## Potential future improvements (teacher feedback pending)

- Additional subject templates (e.g. English, Maths, Science)
- Character count limit warning per report
- Editable report text before download
- Dark mode
- Bulk select/deselect by group

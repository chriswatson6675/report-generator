require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const Anthropic  = require('@anthropic-ai/sdk');

const app    = express();
const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PRONOUN_MAP = {
  'he/him':   { subject: 'he',   object: 'him',  possessive: 'his'   },
  'she/her':  { subject: 'she',  object: 'her',  possessive: 'her'   },
  'they/them':{ subject: 'they', object: 'them', possessive: 'their' },
};

// ── POST /generate-report ─────────────────────────────────────────────────────
app.post('/generate-report', async (req, res) => {
  const { studentName, grades, characteristics, template, gender, timing } = req.body;

  if (!studentName || !grades || !characteristics) {
    return res.status(400).json({ error: 'studentName, grades, and characteristics are required' });
  }

  const GRADE_WORDS = { 1: 'struggling', 2: 'making progress', 3: 'doing well', 4: 'doing really well', 5: 'excelling' };
  const gradeSummary = Object.entries(grades)
    .map(([c, v]) => `${c}: ${v}/5 (${GRADE_WORDS[v] || v})`)
    .join('\n  ');

  const pronouns = PRONOUN_MAP[gender?.toLowerCase()] || PRONOUN_MAP['they/them'];
  const firstName = studentName.split(' ')[0];

  const styleGuide = template === 'formtutor'
    ? `You are writing a formal end-of-term form tutor report for a school report booklet. Write objective, third-person observations about the student's character, effort, and development. The tone is professional and measured.

Good examples:
- "${firstName} has settled into the year well and makes a positive contribution to form time."
- "${firstName} has made good progress this term and is developing stronger relationships with ${pronouns.possessive} peers."
- "${firstName} shows real resilience and would benefit from continuing to develop ${pronouns.possessive} independent study habits."`
    : `You are writing a formal end-of-term Physics report for a school report booklet. Write objective, third-person observations about the student's skills, engagement, and progress. The tone is professional and measured.

Good examples:
- "${firstName} demonstrates strong analytical thinking and communicates ${pronouns.possessive} ideas effectively in group work."
- "${firstName} shows solid problem-solving skills and works well with others in practical activities."
- "${firstName} engages actively in lessons and would benefit from consolidating ${pronouns.possessive} understanding through additional practice."`;

  const TIMING_CONTEXT = {
    'beginning-of-year': `This is a beginning-of-year report. Describe early observations: how ${pronouns.subject} is settling in, initial strengths, and areas to develop. Use language like "is settling in well" or "shows early promise in".`,
    'mid-year':          `This is a mid-year report. Describe progress made so far and what to focus on going forward. Use language like "has made good progress" or "is developing".`,
    'end-of-year':       `This is an end-of-year report. Reflect on the year as a whole — what ${pronouns.subject} has achieved and what to build on. Use language like "has shown strong development" or "has made good progress throughout the year".`,
  };
  const timingContext = TIMING_CONTEXT[timing] || TIMING_CONTEXT['end-of-year'];

  const punctualityGrade = template === 'formtutor' ? (grades['Punctuality'] ?? null) : null;
  const punctualityNote = punctualityGrade !== null ? `
Punctuality grade interpretation (use this to inform any comment about punctuality, time management, or deadlines):
  5: demonstrates strong punctuality and meets deadlines consistently
  4: generally punctual and reliable in meeting commitments
  3: generally punctual and manages time appropriately
  2: punctuality is inconsistent and would benefit from improvement
  1: would benefit from significantly improving punctuality and time management
Current grade: ${punctualityGrade}/5 — use the matching phrase or similar language if punctuality is mentioned.` : '';

  const prompt = `${styleGuide}

Write a 3-4 sentence report for ${studentName}. Use ${pronouns.subject}/${pronouns.object}/${pronouns.possessive} pronouns.

Timing: ${timingContext}

Grades this term:
  ${gradeSummary}${punctualityNote}

Structure:
1. Open with a clear positive observation or strength
2. Address any areas for development honestly but constructively (if grades 1-2, name it directly; if all strong, note what to build on next)
3. Close with a forward-looking, encouraging statement

Rules:
- STRICT third person only — absolutely no "I", "me", "we", "my", or "our"
- Use ${firstName}'s name at least once
- Objective observations only — describe what the student does and shows, not what the teacher thinks or feels
- NO first-person phrases of any kind: "I've noticed", "I can see", "I'm pleased", "I'm confident", "I'd love to", "I look forward to"
- NO personal relationship language: "Let's connect", "feel free to contact me", "I'd be happy to discuss"
- NO future commitments or meeting offers of any kind
- NO phrases like "over the summer", "waiting to come through", "more than the grades reflect"
- NO comparisons to previous years or other students
- NO bullet points, headers, or preamble — output the paragraph only, starting directly`;

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages:   [{ role: 'user', content: prompt }],
    });

    // Strip any intro phrase Claude occasionally prepends despite instructions
    const report = message.content[0].text
      .trim()
      .replace(/^(here(?:'s| is)[^.\n]*[.:\n]\s*|certainly[,!][^.\n]*[.:\n]\s*)/i, '')
      .trim();
    res.json({ report });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: 'Failed to generate report', details: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Report generator running on http://localhost:${PORT}`);
  console.log(`POST http://localhost:${PORT}/generate-report`);
});

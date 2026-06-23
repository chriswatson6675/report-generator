require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const Anthropic  = require('@anthropic-ai/sdk');
const {
  parseMarkScheme,
  parseStudentData,
  calculateTopicPerformance,
  generateTestFeedback,
} = require('./test-feedback-endpoint');

const app    = express();
const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PRONOUN_MAP = {
  'he/him':   { subject: 'he',   object: 'him',  possessive: 'his'   },
  'she/her':  { subject: 'she',  object: 'her',  possessive: 'her'   },
  'they/them':{ subject: 'they', object: 'them', possessive: 'their' },
};

// ── Personal report helper ─────────────────────────────────────────────────────
async function generatePersonalReport(studentName, grades, characteristics, template, gender, timing) {
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
    : template === 'ks3science'
    ? `You are writing a formal end-of-term KS3 Science report for a school report booklet. The student is in Year 7 or 8. Write objective, third-person observations about the student's scientific curiosity, skills, and progress. The tone is professional and encouraging — accessible language that reflects broad science (biology, chemistry, physics topics).

Good examples:
- "${firstName} demonstrates a natural curiosity about scientific ideas and approaches investigations with enthusiasm and care."
- "${firstName} shows strong practical skills and is developing confidence when explaining scientific concepts in writing."
- "${firstName} engages well in collaborative tasks and would benefit from building greater independence when tackling open-ended enquiry work."`
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
- Use first name only (${firstName}) at least once — never full name
- Objective observations only — describe what the student does and shows, not what the teacher thinks or feels
- NO first-person phrases of any kind: "I've noticed", "I can see", "I'm pleased", "I'm confident", "I'd love to", "I look forward to"
- NO personal relationship language: "Let's connect", "feel free to contact me", "I'd be happy to discuss"
- NO future commitments or meeting offers of any kind
- NO phrases like "over the summer", "waiting to come through", "more than the grades reflect"
- NO comparisons to previous years or other students
- NO bullet points, headers, or preamble — output the paragraph only, starting directly`;

  const message = await client.messages.create({
    model:      'claude-haiku-4-5',
    max_tokens: 300,
    messages:   [{ role: 'user', content: prompt }],
  });

  return message.content[0].text
    .trim()
    .replace(/^(here(?:'s| is)[^.\n]*[.:\n]\s*|assessment comment[^.\n]*[.:\n]\s*|certainly[,!][^.\n]*[.:\n]\s*)/i, '')
    .trim();
}

// ── POST /generate-report ─────────────────────────────────────────────────────
app.post('/generate-report', async (req, res) => {
  const { studentName, grades, characteristics, template, gender, timing } = req.body;

  if (!studentName || !grades || !characteristics) {
    return res.status(400).json({ error: 'studentName, grades, and characteristics are required' });
  }

  try {
    const report = await generatePersonalReport(studentName, grades, characteristics, template, gender, timing);
    res.json({ report });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: 'Failed to generate report', details: err.message });
  }
});

// ── POST /api/parse-mark-scheme ───────────────────────────────────────────────
app.post('/api/parse-mark-scheme', async (req, res) => {
  const { pdfBase64 } = req.body;
  if (!pdfBase64) {
    return res.status(400).json({ error: 'pdfBase64 is required' });
  }

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type:   'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          {
            type: 'text',
            text: 'Extract the mark scheme from this document. For each question output exactly one line:\n<question number>  <topic or description>  <max marks>\n\nOutput only those lines — no headings, preamble, or explanation.',
          },
        ],
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    res.json({ markScheme: text });
  } catch (err) {
    console.error('PDF parse error:', err.message);
    res.status(500).json({ error: 'Failed to parse PDF', details: err.message });
  }
});

// ── POST /api/combined-report ─────────────────────────────────────────────────
app.post('/api/combined-report', async (req, res) => {
  const { markScheme, studentData, studentName, subject, grades, template, gender, timing } = req.body;

  if (!markScheme || !studentData || !studentName || !grades) {
    return res.status(400).json({ error: 'markScheme, studentData, studentName, and grades are required' });
  }

  try {
    const { questionToTopic, questionToMaxMark } = parseMarkScheme(markScheme);
    const parsed = parseStudentData(studentData, studentName);
    if (!parsed) {
      return res.status(400).json({ error: `Student "${studentName}" not found in CSV` });
    }
    const topicPerformance = calculateTopicPerformance(parsed, questionToTopic, questionToMaxMark);

    const firstName  = studentName.split(' ')[0];
    const subjectStr = subject || (template === 'ks3science' ? 'Science' : 'Physics');
    const pronouns   = PRONOUN_MAP[gender?.toLowerCase()] || PRONOUN_MAP['they/them'];

    const strengths = Object.entries(topicPerformance)
      .filter(([, d]) => d.percentage >= 75)
      .map(([t, d]) => `${t} (${d.percentage}%)`);
    const weaknesses = Object.entries(topicPerformance)
      .filter(([, d]) => d.percentage < 60)
      .map(([t, d]) => `${t} (${d.percentage}%)`);
    const midRange = Object.entries(topicPerformance)
      .filter(([, d]) => d.percentage >= 60 && d.percentage < 75)
      .map(([t, d]) => `${t} (${d.percentage}%)`);

    const GRADE_WORDS = { 1: 'needs significant development', 2: 'developing', 3: 'satisfactory', 4: 'good', 5: 'excellent' };
    const gradeSummary = Object.entries(grades)
      .map(([c, v]) => `${c}: ${GRADE_WORDS[v] || v}`)
      .join(', ');

    const TIMING_CONTEXT = {
      'beginning-of-year': 'This is a beginning-of-year report.',
      'mid-year':          'This is a mid-year report.',
      'end-of-year':       'This is an end-of-year report.',
    };

    const prompt = `You are writing a formal school report comment for a ${subjectStr} student. Write exactly two short paragraphs.

Paragraph 1 — Personal: A warm, supportive 1–2 sentence comment based solely on ${firstName}'s attendance, punctuality and effort. Reflect the grades given — if effort is low, acknowledge the challenge constructively; if high, praise it specifically.

Paragraph 2 — Subject: Follow this structure exactly:
  a) ONE positive, subject-specific opening sentence about ${firstName}'s demonstrated skills, knowledge or understanding in ${subjectStr}
  b) TWO specific improvements — written in plain, accessible English that a student and parent can easily understand (NOT jargon, NOT generic phrases like "should revise more" — e.g. "would benefit from practising how to explain their ideas clearly in written answers")

Rules for both paragraphs:
- Use plain, accessible English — avoid jargon and overly formal vocabulary
- Write as if speaking directly to a student and their family
- Use first name only: ${firstName}
- STRICT third person — absolutely no "I", "me", "we", "my", "our"
- NO preamble, heading, or meta-commentary — start paragraph 1 directly
- NO phrases like "Here is the report for…" or "Assessment comment:"

${TIMING_CONTEXT[timing] || TIMING_CONTEXT['end-of-year']}

Personal grades: ${gradeSummary}

Test performance:
${strengths.length  ? `  Strengths: ${strengths.join(', ')}` : '  No clear strengths identified'}
${weaknesses.length ? `  Needs work: ${weaknesses.join(', ')}` : ''}
${midRange.length   ? `  Satisfactory: ${midRange.join(', ')}` : ''}

Write the two paragraphs now:`;

    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    });

    const report = message.content[0].text
      .trim()
      .replace(/^(here(?:'s| is)[^.\n]*[.:\n]\s*|assessment comment[^.\n]*[.:\n]\s*|certainly[,!][^.\n]*[.:\n]\s*)/i, '')
      .trim();

    res.json({ report, topicPerformance });
  } catch (err) {
    console.error('Combined report error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/test-feedback ───────────────────────────────────────────────────
app.post('/api/test-feedback', async (req, res) => {
  try {
    const { markScheme, studentData, studentName, subject } = req.body;

    if (!markScheme || !studentData || !studentName) {
      return res.status(400).json({
        error: 'Missing required fields: markScheme, studentData, studentName',
      });
    }

    const { questionToTopic, questionToMaxMark } = parseMarkScheme(markScheme);
    const parsed = parseStudentData(studentData, studentName);

    if (!parsed) {
      return res.status(400).json({ error: 'Student not found in data or invalid CSV format' });
    }

    const topicPerformance = calculateTopicPerformance(
      parsed,
      questionToTopic,
      questionToMaxMark
    );

    const feedback = await generateTestFeedback(
      studentName,
      topicPerformance,
      subject || 'Physics'
    );

    res.json({ studentName, topicPerformance, feedback });
  } catch (error) {
    console.error('Test feedback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Report generator running on http://localhost:${PORT}`);
  console.log(`POST http://localhost:${PORT}/generate-report`);
});

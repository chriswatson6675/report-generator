/**
 * TEST FEEDBACK GENERATOR ENDPOINT
 * Add this to report-generator-server.js
 * 
 * Usage: POST /api/test-feedback
 * Body: {
 *   markScheme: "Question,Topic,Max_Mark\n1,Energy Resources,10\n...",
 *   studentData: "Name,Q1,Q2,...\nAlice,8,3,...",
 *   studentName: "Alice",
 *   subject: "Physics"
 * }
 */

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

// Parse mark scheme text to extract question -> topic mapping
function parseMarkScheme(markSchemeText) {
  const lines = markSchemeText.split("\n").filter((line) => line.trim());
  const questionToTopic = {};
  const questionToMaxMark = {};

  for (const line of lines) {
    // Try to match patterns like "Q1 Energy Resources" or "1 Energy Resources incl pie chart analysis"
    // Try with trailing max-mark number, then without
    const match =
      line.match(/^(?:Q|Question\s)?(\d+)\s+(.*?)\s+(\d+)(?:\s*marks?)?$/i) ||
      line.match(/^(?:Q|Question\s)?(\d+)\s+(.+)$/i);

    if (match) {
      const questionNum = match[1];
      const topic = match[2].trim();
      const maxMark = match[3] ? parseInt(match[3]) : null;

      questionToTopic[questionNum] = topic;
      if (maxMark) {
        questionToMaxMark[questionNum] = maxMark;
      }
    }
  }

  return { questionToTopic, questionToMaxMark };
}

// Parse CSV student data — finds the row matching studentName (or uses first row)
function parseStudentData(csvText, studentName) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return null;

  const headers = lines[0].split(",").map((h) => h.trim());

  let rawRow;
  if (studentName) {
    rawRow = lines.slice(1).find((line) => {
      const name = line.split(",")[0].replace(/^["']|["']$/g, "").trim();
      return name.toLowerCase() === studentName.toLowerCase();
    });
    if (!rawRow) return null;
  } else {
    rawRow = lines[1];
  }

  const dataLine = rawRow.split(",").map((d) => d.trim());

  const studentData = {};
  studentData.name = dataLine[0];

  // Map remaining columns to question numbers
  // Expected: Name, Q1a, Q1b, Q1c, Q2a, Q2b, etc.
  for (let i = 1; i < headers.length; i++) {
    const header = headers[i];
    const mark = dataLine[i] ? parseInt(dataLine[i]) : 0;

    if (!isNaN(mark)) {
      studentData[header] = mark;
    }
  }

  return studentData;
}

// Calculate topic performance
function calculateTopicPerformance(
  studentData,
  questionToTopic,
  questionToMaxMark
) {
  const topicPerformance = {};

  for (const [qNum, topic] of Object.entries(questionToTopic)) {
    if (!topicPerformance[topic]) {
      topicPerformance[topic] = {
        marksGained: 0,
        maxMarks: 0,
        questions: [],
      };
    }

    // Look for marks in student data for this question
    // Handle both "Q1" and "Q1a", "Q1b" etc.
    const questionColumns = Object.keys(studentData).filter((col) =>
      new RegExp(`^Q?${qNum}[a-z]?$`, "i").test(col)
    );

    let questionMarks = 0;
    let maxMarksForQuestion = 0;

    if (questionColumns.length > 0) {
      // Sum marks for all sub-parts of this question
      for (const col of questionColumns) {
        const mark = studentData[col] || 0;
        questionMarks += mark;
      }
      maxMarksForQuestion = questionToMaxMark[qNum] || 10;
    }

    topicPerformance[topic].marksGained += questionMarks;
    topicPerformance[topic].maxMarks += maxMarksForQuestion;
    topicPerformance[topic].questions.push({
      number: qNum,
      marks: questionMarks,
      maxMarks: maxMarksForQuestion,
    });
  }

  // Calculate percentages
  const topicSummary = {};
  for (const [topic, data] of Object.entries(topicPerformance)) {
    const percentage =
      data.maxMarks > 0 ? Math.round((data.marksGained / data.maxMarks) * 100) : 0;
    topicSummary[topic] = {
      percentage,
      marksGained: data.marksGained,
      maxMarks: data.maxMarks,
      questions: data.questions,
    };
  }

  return topicSummary;
}

// Generate feedback using Claude
async function generateTestFeedback(
  studentName,
  topicPerformance,
  subject = "Physics"
) {
  // Identify strengths (>75%) and areas for development (<60%)
  const strengths = [];
  const areasForDevelopment = [];

  for (const [topic, data] of Object.entries(topicPerformance)) {
    if (data.percentage >= 75) {
      strengths.push({ topic, percentage: data.percentage });
    } else if (data.percentage < 60) {
      areasForDevelopment.push({ topic, percentage: data.percentage });
    }
  }

  const prompt = `Generate a professional, student-appropriate assessment comment for a Year 9 Physics test based on this performance:

Student: ${studentName}
Subject: ${subject}

Strengths (>75%):
${strengths.map((s) => `- ${s.topic} (${s.percentage}%)`).join("\n")}

Areas for Development (<60%):
${areasForDevelopment.map((a) => `- ${a.topic} (${a.percentage}%)`).join("\n")}

Requirements:
- Write 2-3 sentences
- Start with: "In the recent ${subject.toLowerCase()} test,"
- Acknowledge specific strengths
- Identify one key area for development
- Use phrases like "demonstrated secure understanding", "would benefit from", "further practice"
- Avoid first person pronouns
- Sound professional but encouraging
- Do NOT mention specific marks or percentages
- Do NOT make promises about future improvement`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

module.exports = {
  parseMarkScheme,
  parseStudentData,
  calculateTopicPerformance,
  generateTestFeedback,
};

/**
 * USAGE IN EXPRESS APP:
 * 
 * Add this route to your server:
 * 
app.post("/api/test-feedback", async (req, res) => {
  try {
    const { markScheme, studentData, studentName, subject } = req.body;

    if (!markScheme || !studentData || !studentName) {
      return res.status(400).json({
        error: "Missing required fields: markScheme, studentData, studentName",
      });
    }

    const { questionToTopic, questionToMaxMark } = parseMarkScheme(markScheme);
    const parsed = parseStudentData(studentData);

    if (!parsed) {
      return res.status(400).json({ error: "Invalid student data format" });
    }

    const topicPerformance = calculateTopicPerformance(
      parsed,
      questionToTopic,
      questionToMaxMark
    );

    const feedback = await generateTestFeedback(
      studentName,
      topicPerformance,
      subject || "Physics"
    );

    res.json({
      studentName,
      topicPerformance,
      feedback,
    });
  } catch (error) {
    console.error("Test feedback error:", error);
    res.status(500).json({ error: error.message });
  }
});
 */

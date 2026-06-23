# Test Feedback Generator - Integration Guide

## Overview
Adds automatic test feedback generation to the Report Generator. Upload a mark scheme and student data, select a student, and generate personalized feedback based on topic-level performance.

## Files Provided

1. **test-feedback-endpoint.js** - Backend logic (Node.js)
2. **TestFeedbackGenerator.jsx** - React component
3. **TestFeedbackGenerator.css** - Component styling

## Backend Integration (Node.js / Express)

### Step 1: Update `report-generator-server.js`

At the top with your other requires, add:

```javascript
const {
  parseMarkScheme,
  parseStudentData,
  calculateTopicPerformance,
  generateTestFeedback,
} = require("./test-feedback-endpoint");
```

### Step 2: Add the route

Add this route before your `app.listen()`:

```javascript
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
```

## Frontend Integration (React)

### Step 1: Add files to your frontend

1. Copy `TestFeedbackGenerator.jsx` to `src/components/`
2. Copy `TestFeedbackGenerator.css` to `src/components/`

### Step 2: Import in your main app

In the file where you render your report components (e.g., `App.jsx`):

```javascript
import TestFeedbackGenerator from './components/TestFeedbackGenerator';
```

### Step 3: Add to your UI

Add it as a new tab or section. Example with tabs:

```javascript
const [activeTab, setActiveTab] = useState('report');

return (
  <div>
    <div className="tabs">
      <button 
        className={activeTab === 'report' ? 'active' : ''}
        onClick={() => setActiveTab('report')}
      >
        Report Generator
      </button>
      <button 
        className={activeTab === 'test-feedback' ? 'active' : ''}
        onClick={() => setActiveTab('test-feedback')}
      >
        Test Feedback
      </button>
    </div>

    {activeTab === 'report' && <ReportGenerator />}
    {activeTab === 'test-feedback' && <TestFeedbackGenerator />}
  </div>
);
```

## Usage Workflow

1. **Prepare Mark Scheme**
   - Copy the question/topic table from the PDF
   - Format: `Question Topic MaxMarks` (one per line)
   - Example:
     ```
     1 Energy Resources incl pie chart analysis 10
     2 Line graph analysis including Nuclear disadvantages 4
     3 National Grid and renewable energy 10
     ```

2. **Paste Student Data**
   - Copy the CSV with student names and marks
   - Format: `Name,Q1a,Q1b,Q1c,Q2a,Q2b,...`
   - Can paste directly from Excel

3. **Select Student**
   - Choose from dropdown (auto-populated from CSV)

4. **Generate**
   - Click "Generate Feedback"
   - View topic breakdown
   - Copy feedback to clipboard

5. **Use in Reports**
   - Paste generated feedback into the main report generator
   - Edit as needed

## Example Output

```
In the recent physics test, Evie demonstrated secure understanding of energy 
resources and the National Grid, showing strong knowledge of key concepts. 
However, she would benefit from further practice with Sankey diagram 
interpretation and renewable energy analysis to build greater confidence in 
these areas.
```

## Data Format Details

### Mark Scheme Format

The parser looks for patterns like:
- `Q1 Energy Resources`
- `1 Energy Resources incl pie chart 10`
- `Question 1 Topic Name Max Mark`

It's flexible - just ensure question number and topic are clear.

### Student CSV Format

- **Row 1**: Headers (`Name,Q1a,Q1b,Q1c,...`)
- **Row 2+**: Student data
- Mark columns can be:
  - Individual parts: `Q1a, Q1b, Q1c, Q2a, Q2b`
  - Or full questions: `Q1, Q2, Q3`
- The parser sums marks for all parts of each question

### Generated Feedback

- 2-3 sentences
- Professional and encouraging tone
- Identifies 1+ strengths (>75% in a topic)
- Identifies 1+ areas for development (<60%)
- No specific marks mentioned
- No first-person pronouns
- No promises about improvement

## Customization

### Change Performance Thresholds

In `TestFeedbackGenerator.jsx`, find:
```javascript
if (data.percentage >= 75) {  // Strength threshold
  strengths.push(...)
} else if (data.percentage < 60) {  // Development threshold
  areasForDevelopment.push(...)
}
```

### Change Feedback Tone

Edit the Claude prompt in `test-feedback-endpoint.js`:
```javascript
const prompt = `Generate a professional, student-appropriate assessment comment...`
```

You can adjust:
- Tone (encouraging, formal, etc.)
- Subject (it's currently Physics)
- Length
- Specific phrases to include/avoid

## Troubleshooting

**"Invalid student data format"**
- Check CSV is properly formatted
- First row should be headers
- Second row should be student data

**"Missing required fields"**
- All three fields must be filled: Mark Scheme, Student Data, Student name selected

**Feedback doesn't mention specific topics**
- Ensure mark scheme topics are clearly separated
- Check student CSV column headers match question numbers

**Performance seems wrong**
- Verify max marks are correctly extracted from mark scheme
- Check student data has all question columns

## File Structure

After integration:
```
project-root/
├── report-generator-server.js (updated)
├── test-feedback-endpoint.js (new)
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── TestFeedbackGenerator.jsx (new)
│       │   └── TestFeedbackGenerator.css (new)
│       └── App.jsx (updated)
```

## Testing

Test with the provided sample data:
- Use `Year_9_AP3_Mark_Scheme.pdf` for mark scheme
- Use `Year_9_AP3_Item_level_Data__-_9SEC.csv` for student data
- Select a student like "Evie Bamford-Minshall"

## Deployment

After testing locally:

1. **Backend**: Deploy updated `report-generator-server.js` to Railway
2. **Frontend**: Deploy updated `src/` to Vercel
3. No new dependencies needed (uses existing Anthropic SDK)

## Future Enhancements

- Bulk feedback generation for all students
- Export feedback as CSV with reports
- Custom threshold percentages per subject
- Comparison to class average
- Trend analysis across multiple tests

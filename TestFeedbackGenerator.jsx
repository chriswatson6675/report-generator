/**
 * TestFeedbackGenerator.jsx
 * 
 * Add this component to your frontend React app
 * Import and use: <TestFeedbackGenerator />
 */

import React, { useState } from "react";
import "./TestFeedbackGenerator.css";

export default function TestFeedbackGenerator() {
  const [markScheme, setMarkScheme] = useState("");
  const [studentData, setStudentData] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");
  const [topicPerformance, setTopicPerformance] = useState(null);

  // Extract student names from CSV
  const getStudentList = () => {
    if (!studentData.trim()) return [];
    const lines = studentData.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    return lines.slice(1).map((line) => {
      const name = line.split(",")[0].trim();
      return name;
    });
  };

  const handleGenerateFeedback = async () => {
    setError("");
    setFeedback(null);

    if (!markScheme.trim()) {
      setError("Please paste the mark scheme");
      return;
    }
    if (!studentData.trim()) {
      setError("Please paste the student data");
      return;
    }
    if (!selectedStudent) {
      setError("Please select a student");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/test-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          markScheme,
          studentData,
          studentName: selectedStudent,
          subject: "Physics",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate feedback");
      }

      const result = await response.json();
      setFeedback(result.feedback);
      setTopicPerformance(result.topicPerformance);
    } catch (err) {
      setError(err.message || "Error generating feedback");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (feedback) {
      navigator.clipboard.writeText(feedback);
      alert("Feedback copied to clipboard!");
    }
  };

  const studentList = getStudentList();

  return (
    <div className="test-feedback-container">
      <h2>Test Feedback Generator</h2>

      <div className="input-section">
        <div className="input-group">
          <label>Mark Scheme (paste text from PDF):</label>
          <textarea
            value={markScheme}
            onChange={(e) => setMarkScheme(e.target.value)}
            placeholder="Question number    Topic                          Max Mark
1    Energy Resources incl pie chart    10
2    Line graph analysis including...   4
..."
            rows={6}
          />
        </div>

        <div className="input-group">
          <label>Student Data (CSV format):</label>
          <textarea
            value={studentData}
            onChange={(e) => setStudentData(e.target.value)}
            placeholder="Name,Q1a,Q1b,Q1c,Q2a,Q2b,...
Alice,2,1,2,0,2,...
Bob,1,2,0,1,1,..."
            rows={6}
          />
        </div>

        <div className="input-group">
          <label>Select Student:</label>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            <option value="">-- Choose a student --</option>
            {studentList.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleGenerateFeedback}
          disabled={loading}
          className="generate-btn"
        >
          {loading ? "Generating..." : "Generate Feedback"}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {topicPerformance && (
        <div className="topic-breakdown">
          <h3>Topic Breakdown</h3>
          <div className="topics-grid">
            {Object.entries(topicPerformance).map(([topic, data]) => (
              <div key={topic} className="topic-card">
                <h4>{topic}</h4>
                <div className="percentage">{data.percentage}%</div>
                <div className="marks">
                  {data.marksGained}/{data.maxMarks} marks
                </div>
                <div className="bar">
                  <div
                    className="bar-fill"
                    style={{ width: `${data.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback && (
        <div className="feedback-section">
          <h3>Generated Feedback</h3>
          <div className="feedback-box">{feedback}</div>
          <button onClick={copyToClipboard} className="copy-btn">
            Copy to Clipboard
          </button>
          <p className="hint">
            Review and edit before adding to the final report.
          </p>
        </div>
      )}
    </div>
  );
}

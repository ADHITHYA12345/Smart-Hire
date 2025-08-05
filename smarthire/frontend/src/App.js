import React, { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [resumeSections, setResumeSections] = useState({});
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("⚠️ Please select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const response = await axios.post("http://localhost:5000/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const extracted = response.data.extracted;
      const aiGeneratedQuestions = response.data.aiQuestions;
      const aiGeneratedAnswers = response.data.aiAnswers;

      if (!extracted) throw new Error("No extracted content received");

      setResumeSections(extracted);
      setUploadStatus("✅ Resume uploaded and parsed successfully!");

      // Parse questions
      if (aiGeneratedQuestions) {
        const parsedQuestions = aiGeneratedQuestions
          .split("\n")
          .filter(q => q.trim() !== "")
          .map(q => q.replace(/^\d+\.\s*/, ""));
        setQuestions(parsedQuestions);
      } else {
        setQuestions([]);
      }

      // Parse answers
      if (aiGeneratedAnswers) {
        const parsedAnswers = aiGeneratedAnswers
          .split("\n")
          .filter(a => a.trim() !== "")
          .map(a => a.replace(/^\d+\.\s*/, ""));
        setAnswers(parsedAnswers);
      } else {
        setAnswers([]);
      }

    } catch (error) {
      console.error("Upload error:", error);
      if (error.response) {
        console.error("Backend Response Error:", error.response.data);
      }
      setUploadStatus("❌ Failed to upload file.");
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>📄 SmartHire Resume Upload</h2>
        <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
        <button onClick={handleUpload}>Upload Resume</button>
        <p className="status">{uploadStatus}</p>

        {/* Resume Sections */}
        {Object.keys(resumeSections).length > 0 && (
          <div className="resume-section">
            <h3>📘 Extracted Resume Sections</h3>

            {resumeSections.Education && (
              <div className="resume-block">
                <h4>🎓 Education</h4>
                <pre>{resumeSections.Education}</pre>
              </div>
            )}

            {resumeSections.Projects && (
              <div className="resume-block">
                <h4>💻 Projects</h4>
                <pre>{resumeSections.Projects}</pre>
              </div>
            )}

            {resumeSections.Skills && (
              <div className="resume-block">
                <h4>🛠️ Skills</h4>
                <pre>{resumeSections.Skills}</pre>
              </div>
            )}

            {resumeSections.Experience && (
              <div className="resume-block">
                <h4>🏢 Experience</h4>
                <pre>{resumeSections.Experience}</pre>
              </div>
            )}
          </div>
        )}

        {/* Questions Section */}
        {questions.length > 0 && (
          <div className="questions-section">
            <h3>🧠 AI Interview Questions</h3>
            <ul>
              {questions.map((q, index) => (
                <li key={index}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Answers Section */}
        {answers.length > 0 && (
          <div className="answers-section">
            <h3>✅ AI Suggested Answers</h3>
            <ul>
              {answers.map((ans, index) => (
                <li key={index}>
                  <strong>Q{index + 1}:</strong> {questions[index] || "(No question found)"}<br />
                  <strong>A:</strong> {ans}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;








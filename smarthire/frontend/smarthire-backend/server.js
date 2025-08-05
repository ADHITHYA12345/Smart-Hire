require('dotenv').config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const axios = require("axios"); // Make sure axios is installed: npm install axios

const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// ✅ OpenRouter API Key (replace with your own)
// IMPORTANT: For production, use environment variables!
// Example: Create a .env file in the same directory as server.js with:
// OPENROUTER_API_KEY="sk-or-v1-your_actual_key_here"
// Then, at the very top of this file, add: require('dotenv').config();
// And use: process.env.OPENROUTER_API_KEY
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // Replace this with your actual OpenRouter key

// Health check route
app.get("/", (req, res) => {
  res.send("🚀 SmartHire backend running!");
});

// Upload endpoint
app.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const pdfBuffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(pdfBuffer);
    // Basic cleaning: replace multiple spaces with single, multiple newlines with single
    const cleanText = data.text.replace(/\s{2,}/g, " ").replace(/\n{2,}/g, "\n").trim();

    // Extract resume sections
    const extractRelevantSections = (text) => {
      const lines = text.split("\n");
      const result = {
        Education: "",
        Projects: "",
        Skills: "",
        Experience: ""
      };
      let currentSection = ""; // Renamed to avoid confusion with `current` variable

      // Define keywords for sections (case-insensitive)
      const sectionKeywords = {
        "education": "Education",
        "project": "Projects",
        "skill": "Skills",
        "experience": "Experience",
        "internship": "Experience"
      };

      lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine === "") {
          return; // Skip empty lines for section detection
        }

        let foundNewSection = false;
        for (const keyword in sectionKeywords) {
          if (trimmedLine.toLowerCase().includes(keyword)) {
            // If a new section keyword is found, update the current section
            currentSection = sectionKeywords[keyword];
            foundNewSection = true;
            // Optionally, you might want to start a new line for the content of the new section
            // result[currentSection] += trimmedLine + "\n"; // Include the heading itself
            break;
          }
        }

        // If no new section was found, and we are in a section, append the line
        if (!foundNewSection && currentSection) {
          result[currentSection] += trimmedLine + "\n";
        }
      });

      // Trim any trailing newlines from sections
      for (const key in result) {
          result[key] = result[key].trim();
      }

      return result;
    };

    const sections = extractRelevantSections(cleanText);

    // Step 1: Generate Questions
    const questionPrompt = `
You are an AI interviewer. Based on the following resume sections:

Skills:
${sections.Skills || "Not Provided"}

Projects:
${sections.Projects || "Not Provided"}

Experience:
${sections.Experience || "Not Provided"}

Generate 10 technical interview questions tailored to this candidate's background. Only return the questions in a numbered list (e.g., "1. Question", "2. Question").
`;

    // Log the prompt to see what's sent to the AI for questions
    console.log("📝 Prompt being sent for Questions:\n", questionPrompt);

    const questionResponse = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini", // Keeping this model as it's working for you
        messages: [{ role: "user", content: questionPrompt }]
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000", // Your frontend URL for OpenRouter analytics
          "X-Title": "SmartHire AI Interviewer" // Your application title for OpenRouter analytics
        }
      }
    );

    const questions = questionResponse.data.choices[0].message.content;

    // Log the full response data for questions
    console.log("✅ Successfully called OpenRouter API for Questions.");
    console.log("OpenRouter Questions Response Data:", JSON.stringify(questionResponse.data, null, 2));


    // Step 2: Generate Answers - REFINED PROMPT for better formatting
    const answerPrompt = `
You are a helpful AI candidate preparing for an interview.
Based on the following resume sections and the provided interview questions, generate concise and direct answers for each question.
Adhere strictly to the numbered format of the questions provided.
Do NOT repeat the question in your answer.
Do NOT include any introductory or concluding remarks (e.g., "Certainly!", "Here are the answers...", "Thank you for the questions!").
Just provide the numbered answer corresponding to the question's number.
If a question has multiple parts, answer all parts within its numbered response.

Resume Sections:
Skills:
${sections.Skills || "Not Provided"}
Projects:
${sections.Projects || "Not Provided"}
Experience:
${sections.Experience || "Not Provided"}

Technical Interview Questions (Answer these in the same numbered format, e.g., "1. Question text"):
${questions}

Example Answer Format:
1. This is the concise and direct answer to question 1, covering all its parts.
2. This is the concise and direct answer to question 2.
3. This is the concise and direct answer to question 3.
... (and so on for all 10 questions)
`;

    // Log the prompt to see what's sent to the AI for answers
    console.log("📝 Prompt being sent for Answers:\n", answerPrompt);

    const answerResponse = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini", // Keeping this model
        messages: [{ role: "user", content: answerPrompt }]
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "SmartHire AI Interviewer"
        }
      }
    );

    const answers = answerResponse.data.choices[0].message.content;

    // Log the full response data for answers
    console.log("✅ Successfully called OpenRouter API for Answers.");
    console.log("OpenRouter Answers Response Data:", JSON.stringify(answerResponse.data, null, 2));


    // ✅ Respond with data to the frontend
    res.json({
      message: "✅ Resume uploaded, questions and answers generated!",
      extracted: sections,
      aiQuestions: questions, // Sending the raw string of questions
      aiAnswers: answers      // Sending the raw string of answers
    });

  } catch (err) {
    // --- START OF ENHANCED ERROR HANDLING ---
    console.error("❌ Error processing resume:");
    if (axios.isAxiosError(err)) { // Check if it's an Axios error
        if (err.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx (e.g., 400, 401, 500)
            console.error("OpenRouter API Error Status:", err.response.status);
            console.error("OpenRouter API Error Data:", err.response.data); // **** THIS IS THE KEY FOR API ERRORS ****
            console.error("OpenRouter API Error Headers:", err.response.headers);
        } else if (err.request) {
            // The request was made but no response was received
            console.error("OpenRouter API No Response Received:", err.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error("OpenRouter API Request Setup Error:", err.message);
        }
        console.error("Axios Error Config:", err.config); // Show the request config that failed
    } else {
        // Generic error (e.g., from pdf-parse or file system operations)
        console.error("General Error:", err.message);
    }
    console.error("Full Error Stack:", err.stack); // Still useful for the full stack trace
    res.status(500).json({ message: "Error processing resume or generating questions/answers." });
    // --- END OF ENHANCED ERROR HANDLING ---
  } finally {
    // Clean uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ SmartHire backend running at http://localhost:${PORT}`);
});
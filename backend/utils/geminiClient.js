// utils/geminiClient.js
// -----------------------------------------------------------------------
// Wraps Google's Gemini API so our routes don't need to know prompt or
// streaming details. Uses Gemini instead of a paid LLM provider because
// Gemini's API has a generous free tier.
//
// Get a free API key at: https://aistudio.google.com/apikey
// -----------------------------------------------------------------------

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// -----------------------------------------------------------------------
// buildPrompt()
// Gemini's simple text API doesn't have a separate "system" vs "user"
// message the way some other APIs do for basic text generation, so we
// combine our instructions and the user's data into one prompt.
// -----------------------------------------------------------------------
function buildPrompt({ resume, jobDescription }) {
  return `You are an expert resume writer and ATS (Applicant Tracking System) optimization specialist.

Your task: rewrite the candidate's resume so it is tailored to the given job description.

Rules you MUST follow:
1. Do NOT invent skills, experience, or achievements the candidate does not already have in their original resume.
2. Reorder and rephrase existing bullet points to emphasize relevance to the job description.
3. Mirror important keywords and phrasing from the job description where the candidate genuinely has that skill.
4. Keep the output in clean, plain-text resume format (no markdown symbols like ** or #).
5. Keep the same factual content - only the emphasis, wording, and ordering should change.
6. Do not include any commentary, explanation, or notes - output ONLY the tailored resume text.

JOB DESCRIPTION:
${jobDescription}

ORIGINAL RESUME:
${resume}

Now produce the tailored resume following the rules above.`;
}

// -----------------------------------------------------------------------
// streamTailoredResume()
// Calls the Gemini API with streaming enabled and forwards each chunk of
// text to a callback (onChunk) as it arrives - same interface our
// generate.js route already expects, so nothing else needs to change.
// -----------------------------------------------------------------------
async function streamTailoredResume({ resume, jobDescription, onChunk }) {
  const prompt = buildPrompt({ resume, jobDescription });

  // generateContentStream returns an async iterable - each "chunk" is a
  // small piece of the response as Gemini generates it.
  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash", // fast, free-tier-friendly model - good enough for this task
    contents: prompt,
  });

  let fullText = "";

  for await (const chunk of stream) {
    const textChunk = chunk.text;
    if (textChunk) {
      fullText += textChunk;
      onChunk(textChunk); // forward immediately to the caller (our Express route)
    }
  }

  return fullText; // full text returned so we can save it to MongoDB
}

module.exports = { streamTailoredResume };

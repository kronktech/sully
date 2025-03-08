const fetch = require("node-fetch");
const dotenv = require("dotenv");

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = "gpt-4o-realtime-preview-2024-12-17";
const SUMMARY_MODEL = "gpt-4o";

/**
 * Creates an ephemeral token for the OpenAI Realtime API
 * @param {string} voice - The voice to use for the model
 * @returns {Promise<Object>} - The session data with the ephemeral token
 */
async function createEphemeralToken(voice = "verse") {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: REALTIME_MODEL,
          voice,
          turn_detection: {
            type: "server_vad",
            create_response: false,
          },
          input_audio_transcription: {
            model: "whisper-1",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating ephemeral token:", error);
    throw error;
  }
}

/**
 * Generates a summary of the conversation using GPT-4
 * @param {Array} transcripts - Array of transcript objects with text and translations
 * @returns {Promise<Object>} - The summary and any detected actions
 */
async function generateSummary(transcripts) {
  console.log("Generating summary", transcripts);

  try {
    const messages = [
      {
        role: "system",
        content: `You are a medical conversation summarizer. Given a conversation between a doctor and patient:

1. Provide a SOAP note summary of the conversation with Subjective, Objective, Assessment, and Plan sections. Use headers, bolded text, and lists for clarity.
2. Identify if any of these actions were discussed or needed:
   - Schedule a follow-up appointment
   - Send a lab order
3. For each action, extract relevant details (e.g. timeframe for follow-up, type of lab test)

**If any of these sections were not discussed during the visit do NOT include them or make up information which was not discussed.**

Return ONLY a JSON object with following schema:

{ "summary": "<string>", "actions": [<List of actions>], "name": "<A short title for the visit (1-5 words)>" }
 
Each action must be one of the following schemas:

{ "type": "schedule_followup", "details": { "timeframe": "<string>", "reason": "<string>", "specialty": "<string>" } }
{ "type": "order_lab", "details": { "test_type": "<string>", "urgency": "<string>", "instructions": "<string>" } }`,
      },
      {
        role: "user",
        content: transcripts
          .map(
            (t) =>
              `${t.role.toUpperCase()}: ${t.text}\nTRANSLATION: ${
                t.translation
              }\n`
          )
          .join("\n"),
      },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        messages,
        response_format: { type: "json_object" }, // Force JSON response
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log("Summary response", content);

    // Clean up any potential markdown formatting
    const cleanJson = content.replace(/```json\n|\n```|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error generating summary:", error);
    throw error;
  }
}

module.exports = {
  createEphemeralToken,
  generateSummary,
};

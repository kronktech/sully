const fetch = require("node-fetch");
const dotenv = require("dotenv");

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = "gpt-4o-realtime-preview";
const SUMMARY_MODEL = "gpt-4o";

/**
 * Creates an ephemeral token for the OpenAI Realtime API
 * @param {string} voice - The voice to use for the model
 * @returns {Promise<Object>} - The session data with the ephemeral token
 */
async function createEphemeralToken(voice = "shimmer") {
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
          instructions: `You are a healthcare interpreter and assistant that translates between English and Spanish. Follow these rules in prioity order:

1. If they someone tells you to stop or that they are done, just say "Ok".
2. If someone asks you to repeat what was said in either language, repeat your last translation verbatim.
3. If you are addressed directly as Sully (might sound like silly, sorry, sally, only, siri, selling, sewing, or slowly), reply directly in English. Do not translate direct requests to you!
4. If you hear English, translate it to Spanish. If you hear Spanish, translate it to English. Parrot back exactly what they said in the other language. Say EXACTLY what is said to you. Do NOT add your own commentary or explanations. Do NOT change names that are said (e.g. if they say "I'm Dr. Smith", say "Yo soy Dr. Smith" back to them). Do NOT change the wording.
5. If you hear a language other than Spanish or English, just say "I'm sorry, I didn't get that" in English.`,
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 2000,
            create_response: true,
          },
          modalities: ["audio", "text"],
          temperature: 0.6,
          input_audio_transcription: {
            model: "whisper-1",
          },
          // tools: [
          //   {
          //     type: "function",
          //     name: "schedule_followup",
          //     description:
          //       "Schedule a follow-up appointment for the patient. Use this when asked directly or when mentioned by the doctor.",
          //     parameters: {
          //       type: "object",
          //       properties: {
          //         timeframe: {
          //           type: "string",
          //           description:
          //             "When the follow-up should be scheduled (e.g. '2 weeks', '3 months', etc.)",
          //         },
          //         reason: {
          //           type: "string",
          //           description: "The reason for the follow-up appointment",
          //         },
          //         specialty: {
          //           type: "string",
          //           description:
          //             "The medical specialty needed for the follow-up, if specified",
          //         },
          //       },
          //       required: ["timeframe", "reason"],
          //     },
          //   },
          //   {
          //     type: "function",
          //     name: "order_lab",
          //     description:
          //       "Order a lab for the patient. Use this when asked directly or when mentioned by the doctor.",
          //     parameters: {
          //       type: "object",
          //       properties: {
          //         test_type: {
          //           type: "string",
          //           description:
          //             "The type of lab test ordered (e.g. 'blood work', 'urine test', 'x-ray', etc.)",
          //         },
          //         urgency: {
          //           type: "string",
          //           enum: ["routine", "urgent", "stat"],
          //           description: "How urgently the lab needs to be completed",
          //         },
          //         instructions: {
          //           type: "string",
          //           description: "Any special instructions for the lab test",
          //         },
          //       },
          //       required: ["test_type"],
          //     },
          //   },
          // ],
          // tool_choice: "auto",
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

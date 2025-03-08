const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { createEphemeralToken, generateSummary } = require("./openai");
const { Conversation } = require("./models/conversation");
const fetch = require("node-fetch");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Constants
const WEBHOOK_URL = "https://webhook.site/7dd3d15d-c150-482e-afc7-f147823f51cb";

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const handleAction = async (action) => {
  const webhookResponse = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action),
  });

  if (!webhookResponse.ok) {
    throw new Error("Webhook call failed");
  }
};

// Routes
app.post("/api/session", async (req, res) => {
  try {
    const { voice = "alloy" } = req.body;
    const sessionData = await createEphemeralToken(voice);
    res.json(sessionData);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// Generate summary
app.post("/api/summary", async (req, res) => {
  try {
    const { transcripts } = req.body;
    if (!transcripts || !Array.isArray(transcripts)) {
      return res.status(400).json({ error: "Invalid transcripts data" });
    }

    const result =
      transcripts.length > 0
        ? await generateSummary(transcripts)
        : { summary: "No patient conversation took place." };

    res.json({
      name: result.name,
      summary: result.summary,
      actions: result.actions.map((action) => ({
        type: action.type,
        details: action.details,
        createdAt: new Date().toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

// Store conversation
app.post("/api/conversations", async (req, res) => {
  try {
    const { transcript, summary, actions, createdAt } = req.body;

    console.log("Saving conversation", transcript, summary, actions, createdAt);

    const conversation = new Conversation({
      transcript,
      summary,
      actions,
      createdAt,
    });

    console.log("Saving conversation", conversation);

    actions.forEach(async (action) => {
      await handleAction(action);
    });

    await conversation.save();
    res.status(201).json(conversation);
  } catch (error) {
    console.error("Error saving conversation:", error);
    res.status(500).json({ error: "Failed to save conversation" });
  }
});

// Get conversations
app.get("/api/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find().sort({ createdAt: -1 });
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

app.post("/api/webhook", async (req, res) => {
  try {
    await handleAction(req.body);

    res.json({ success: true });
  } catch (error) {
    console.error("Error forwarding to webhook:", error);
    res.status(500).json({ error: "Failed to forward to webhook" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

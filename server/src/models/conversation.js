const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    transcript: [
      {
        role: {
          type: String,
          enum: ["patient", "doctor"],
          required: true,
        },
        text: { type: String, required: true },
        translation: { type: String, required: true },
        languageCode: {
          type: String,
          enum: ["eng", "spa"],
          required: true,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    summary: { type: String },
    actions: [
      {
        type: {
          type: String,
          enum: ["schedule_followup", "order_lab"],
          required: true,
        },
        details: { type: mongoose.Schema.Types.Mixed },
        completed: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        name: { type: String },
      },
    ],
    createdAt: { type: Date, default: Date.now },
    name: { type: String },
  },
  { timestamps: true }
);

const Conversation = mongoose.model("Conversation", conversationSchema);

module.exports = { Conversation };

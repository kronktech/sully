import { v4 as uuidv4 } from "uuid";
import { dispatch } from "../store";
import { WAKE_WORD_REGEX } from "./wakeWordRecognition";
import {
  requestAction,
  requestMetadata,
  stopListening,
  handleFunctionCall,
  requestTranslation,
} from "./webrtc";
import {
  addTranscript,
  addTranscriptMetadata,
  addTranslation,
} from "../store/interpreterSlice";

let lastTranslation = null;

const handleEvent = async (e) => {
  try {
    const event = JSON.parse(e.data);

    // Handle different event types
    if (
      event.type === "conversation.item.input_audio_transcription.completed"
    ) {
      console.log("Input:", event);
      const transcript = event.transcript;

      // Check for stop command first
      const lowerTranscript = transcript.toLowerCase().trim();

      if (
        lowerTranscript.match(WAKE_WORD_REGEX) &&
        lowerTranscript.match(/stop|end|done|finish|cancel|over/)
      ) {
        console.log("Stop command detected");
        stopListening();
        return;
      }

      const transcriptId = uuidv4();

      console.log("AddTranscript:", transcript);

      // Add to transcript only if it's not a stop command
      dispatch(
        addTranscript({
          id: transcriptId,
          text: transcript,
          createdAt: new Date().getTime(),
        })
      );
      requestTranslation(transcriptId, transcript);
      requestMetadata(transcriptId, transcript);
    } else if (event.type === "response.done") {
      console.log("Output:", event);

      const metadata = event.response.metadata;
      const topic = metadata?.topic;

      if (
        topic === "metadata" &&
        event.response.output[0]?.type === "message"
      ) {
        let transcriptionMetadata = {
          isAction: false,
          languageCode: null,
        };

        try {
          transcriptionMetadata = JSON.parse(
            event.response.output[0].content[0].text
          );
        } catch (error) {
          console.error("Error parsing metadata response:", error);
          return;
        }

        if (transcriptionMetadata.actions.length > 0) {
          transcriptionMetadata.actions.forEach((action) => {
            requestAction(action);
          });
        }

        console.log("AddTranscriptMetadata:", transcriptionMetadata, {
          role:
            transcriptionMetadata.languageCode === "eng"
              ? "doctor"
              : transcriptionMetadata.languageCode === "spa"
              ? "patient"
              : "other",
          languageCode: transcriptionMetadata.languageCode,
        });
        dispatch(
          addTranscriptMetadata({
            id: metadata.transcriptId,
            role:
              transcriptionMetadata.languageCode === "eng"
                ? "doctor"
                : transcriptionMetadata.languageCode === "spa"
                ? "patient"
                : "other",
            languageCode: transcriptionMetadata.languageCode,
          })
        );
      } else if (
        topic === "translation" &&
        event.response.output[0]?.type === "message"
      ) {
        const translation = event.response.output[0].content[0].transcript;
        console.log("AddTranslation:", metadata, translation);
        lastTranslation = translation;
        dispatch(
          addTranslation({
            id: metadata.transcriptId,
            translation,
          })
        );
      } else if (
        event.response.output?.[0] &&
        event.response.output[0].type === "function_call"
      ) {
        const functionCall = event.response.output[0];
        console.log("Function call detected:", {
          name: functionCall.name,
          arguments: JSON.parse(functionCall.arguments),
          callId: functionCall.call_id,
        });

        // Handle function call via webRTC module
        handleFunctionCall(functionCall);
      }
    }
  } catch (error) {
    console.error("Error handling model message:", error);
  }
};

export { handleEvent };

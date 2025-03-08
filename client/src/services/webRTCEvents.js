import { dispatch } from "../store";
import { WAKE_WORD_REGEX } from "./wakeWordRecognition";
import { requestMetadata, stopListening, handleFunctionCall } from "./webrtc";
import {
  addTranscript,
  addTranscriptMetadata,
  addTranslation,
} from "../store/interpreterSlice";

let latestTranslation = null;

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

      requestMetadata(transcript);

      console.log("AddTranscript:", transcript);

      // Add to transcript only if it's not a stop command
      dispatch(
        addTranscript({
          text: transcript,
          createdAt: new Date().getTime(),
        })
      );
    } else if (event.type === "response.done") {
      console.log("Output:", event);

      if (
        event.response.metadata?.topic === "metadata" &&
        event.response.output[0].type === "message"
      ) {
        let metadata = {
          isAction: false,
          languageCode: null,
        };

        try {
          metadata = JSON.parse(event.response.output[0].content[0].text);
        } catch (error) {
          console.error("Error parsing metadata response:", error);
          return;
        }

        // const isAction = Boolean(metadata.action) && metadata.action !== "null";

        // if (isAction) {
        //   requestAction(metadata);
        // }

        console.log("AddTranscriptMetadata:", metadata, {
          role:
            metadata.languageCode === "eng"
              ? "doctor"
              : metadata.languageCode === "spa"
              ? "patient"
              : "other",
          languageCode: metadata.languageCode,
          action: metadata.action,
          actionDetails: metadata.actionDetails,
          timestamp: new Date().getTime(),
        });
        dispatch(
          addTranscriptMetadata({
            role:
              metadata.languageCode === "eng"
                ? "doctor"
                : metadata.languageCode === "spa"
                ? "patient"
                : "other",
            languageCode: metadata.languageCode,
            action: metadata.action,
            actionDetails: metadata.actionDetails,
            timestamp: new Date().getTime(),
          })
        );
      } else if (event.response.output?.[0]) {
        // Check if this is a function call
        if (event.response.output[0].type === "function_call") {
          const functionCall = event.response.output[0];
          console.log("Function call detected:", {
            name: functionCall.name,
            arguments: JSON.parse(functionCall.arguments),
            callId: functionCall.call_id,
          });

          // Handle function call via webRTC module
          handleFunctionCall(functionCall);
        } else {
          // Handle normal translation response
          const translation = event.response.output[0].content[0].transcript;
          console.log("AddTranslation:", translation);
          dispatch(
            addTranslation({
              translation,
              timestamp: new Date().getTime(),
            })
          );
          latestTranslation = translation;
        }
      }
    }
  } catch (error) {
    console.error("Error handling model message:", error);
  }
};

export { handleEvent };

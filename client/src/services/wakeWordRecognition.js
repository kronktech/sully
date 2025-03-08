import { clearTranscripts } from "../store/interpreterSlice";
import { connect } from "./webrtc";
import { dispatch } from "../store";

const WAKE_WORD_REGEX =
  /sully|silly|sorry|sally|only|siri|selling|slowly|sewing/;
const grammar =
  "#JSGF V1.0; grammar wake; public <wake> = sully | silly | sorry| sally | only | siri | selling | slowly | sewing ;";
const NON_RETRYABLE_ERRORS = ["no-speech", "not-allowed"];
const timeouts = [];
let isRetrying = false;
let isSullyActivated = false;
let isTranslating = false;

const retry = (recognition) => {
  if (isTranslating || isRetrying) return;

  isRetrying = true;

  setTimeout(() => {
    try {
      recognition.start();
    } catch (error) {
      console.error("Error restarting recognition:", error);
    } finally {
      isRetrying = false;
    }
  }, 1000);
};

const monitorForWakeWord = () => {
  if (!window.webkitSpeechRecognition) {
    console.error("Speech recognition not supported in this browser");
    return;
  }

  const recognition = new (window.SpeechRecognition ||
    window.webkitSpeechRecognition)();
  const speechRecognitionList = new (window.SpeechGrammarList ||
    window.webkitSpeechGrammarList)();

  speechRecognitionList.addFromString(grammar, 1);

  recognition.grammars = speechRecognitionList;
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.lang = "en-US"; // Default to English for wake words

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript
      .toLowerCase()
      .trim();
    const heardWakeWord = transcript.match(WAKE_WORD_REGEX);

    // First check for "sully" wake word
    if (heardWakeWord) {
      isSullyActivated = true;

      // Clear any existing timeout
      if (timeouts.length > 0) {
        timeouts.forEach((timeout) => clearTimeout(timeout));
      }

      // Set new timeout to deactivate after 5 seconds
      const timeout = setTimeout(() => {
        isSullyActivated = false;
      }, 5000);

      timeouts.push(timeout);
    }

    // Only check for translation commands if Sully was activated
    if (
      isSullyActivated &&
      transcript.match(/translate|translation|start|begin|go/)
    ) {
      dispatch(clearTranscripts());
      isSullyActivated = false; // Reset activation state
      isTranslating = true;
      connect();
      recognition.stop();
    }
  };

  recognition.onerror = (event) => {
    console.error("Wake word detection error:", event);
    // Restart recognition if it stops due to error
    if (!NON_RETRYABLE_ERRORS.includes(event.error)) {
      retry(recognition);
    }
  };

  recognition.onend = () => {
    retry(recognition);
  };

  // Start wake word detection immediately
  try {
    recognition.start();
  } catch (error) {
    console.error("Error starting wake word detection:", error);
  }

  return () => {
    try {
      console.log("Stopping wake word detection");
      recognition.stop();
    } catch (error) {
      console.error("Error stopping recognition:", error);
    }
  };
};

export { WAKE_WORD_REGEX, monitorForWakeWord };

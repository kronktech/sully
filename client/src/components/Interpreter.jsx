import React, { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  getSummary,
  saveConversation,
  setStopping,
  setSummary,
  setShowConversationModal,
  fetchConversations,
} from "../store/interpreterSlice";
import { getCompletedTranscripts } from "../utils/transcriptUtils";
import ReactMarkdown from "react-markdown";
import ConversationModal from "./ConversationModal";
import "./Interpreter.css";
import langs from "langs";
import { monitorForWakeWord } from "../services/wakeWordRecognition";

const Interpreter = () => {
  const dispatch = useDispatch();
  const {
    isListening,
    isConnecting,
    transcripts,
    error,
    detectedActions,
    summary,
    isStopping,
  } = useSelector((state) => state.interpreter);
  const transcriptRef = useRef(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  useEffect(() => {
    // Fetch conversations when component mounts
    dispatch(fetchConversations());
  }, [dispatch]);

  useEffect(() => {
    const completedTranscripts = getCompletedTranscripts(transcripts);

    if (isStopping && completedTranscripts.length > 0) {
      console.log("Saving conversation", completedTranscripts);
      setIsLoadingSummary(true);
      // Get summary and save conversation
      dispatch(getSummary(completedTranscripts))
        .unwrap()
        .then((result) => {
          dispatch(setSummary(result.summary));

          console.log("Got summary", result);

          // Save the complete conversation with summary
          return dispatch(
            saveConversation({
              name: result.name,
              actions: detectedActions,
              transcript: completedTranscripts,
              summary: result.summary,
              createdAt: new Date().toISOString(),
            })
          ).then(() => setIsLoadingSummary(false));
        })
        .catch((err) => console.error("Error processing conversation:", err));
    }

    dispatch(setStopping(false));
  }, [isListening, transcripts]);

  useEffect(monitorForWakeWord, []);

  // Auto-scroll effect
  useEffect(() => {
    if (
      !summary &&
      transcriptRef.current &&
      transcripts.every((t) => t.hasMetadata && t.hasTranslation)
    ) {
      transcriptRef.current.scrollTo({
        top: transcriptRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [transcripts]);

  const completedTranscripts = getCompletedTranscripts(transcripts);

  const handleLoadConversations = () => {
    dispatch(fetchConversations());
    dispatch(setShowConversationModal(true));
  };

  return (
    <div className="page">
      <div className="header">
        <img src="/logo.svg" alt="Sully.ai" className="logo" />
        <h2>Patient Visit</h2>
        <div className="load-button-container">
          <div className="load-button" onClick={handleLoadConversations}>
            Load Conversation
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="card-container card">
          <div className="card-header">
            <h2>Conversation</h2>
            {isListening && (
              <div className="listening-indicator">Listening...</div>
            )}
          </div>
          {isConnecting ? (
            <div className="connecting-indicator">
              <div className="connecting-spinner"></div>
              <p>Connecting to service...</p>
            </div>
          ) : completedTranscripts.length === 0 && !isListening ? (
            <div className="empty-text">
              <ul>
                <li>
                  <strong>Sully</strong> is <strong>voice activated</strong>.
                </li>
                <li>
                  Ask Sully to <strong>translate</strong> whenever you're ready.
                </li>
                <li>
                  Ask Sully to <strong>schedule appointments</strong> or{" "}
                  <strong>order labs</strong> as needed.
                </li>
                <li>
                  Tell Sully to <strong>stop</strong> when you're done.
                </li>
              </ul>
            </div>
          ) : (
            <div className="transcript" ref={transcriptRef}>
              {completedTranscripts.map((transcript, i) => (
                <div key={i} className={`transcript-item ${transcript.role}`}>
                  <div className="transcript-header">
                    <span className="role">
                      {`${
                        transcript.role === "doctor" ? "Doctor" : "Patient"
                      } (${
                        langs.where("3", transcript.languageCode)?.name ||
                        "Unknown"
                      })`}
                    </span>
                    <span className="timestamp">
                      {new Date(transcript.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="original-text">
                    {transcript.languageCode === "eng"
                      ? transcript.text
                      : transcript.translation}
                  </p>
                </div>
              ))}
              {isListening && (
                <div className="bottom-listening-indicator">
                  <div className="pulse-circle"></div>
                </div>
              )}
            </div>
          )}

          {/* Hidden audio elements */}
          <audio id="interpreterAudio" className="hidden" />
          <audio
            id="activationSound"
            src="/activation-sound.mp3"
            className="hidden"
          />

          {error && <div className="error-message">Error: {error}</div>}
        </div>

        <div className="right-column">
          <div className="card-container card">
            <div className="card-header">
              <h2>Summary</h2>
            </div>
            <div className="summary">
              {isLoadingSummary ? (
                <div className="connecting-indicator">
                  <div className="connecting-spinner"></div>
                  <p>Loading summary...</p>
                </div>
              ) : summary ? (
                <ReactMarkdown>{summary}</ReactMarkdown>
              ) : (
                <p className="empty-text">
                  Say "Sully, stop" when you're ready to summarize the
                  appointment.
                </p>
              )}
            </div>
          </div>
          <div className="card-container card">
            <div className="card-header">
              <h2>Action Items</h2>
            </div>
            <div className="actions">
              {detectedActions.length > 0 ? (
                <ul>
                  {detectedActions.map((action, i) => (
                    <li key={i} className="action-item">
                      <div className="action-header">
                        <strong>
                          {action.type === "schedule_followup"
                            ? "Follow-up Appointment"
                            : "Lab Order"}
                        </strong>
                        <span className="timestamp">
                          {new Date(action.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {action.type === "schedule_followup" ? (
                        <div className="action-details">
                          <p>Timeframe: {action.details.timeframe}</p>
                          <p>Reason: {action.details.reason}</p>
                          {action.details.specialty && (
                            <p>Specialty: {action.details.specialty}</p>
                          )}
                        </div>
                      ) : (
                        <div className="action-details">
                          <p>Test: {action.details.test_type}</p>
                          <p>Urgency: {action.details.urgency}</p>
                          {action.details.instructions && (
                            <p>Instructions: {action.details.instructions}</p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : summary ? (
                <p className="empty-text">
                  No action items were found in this conversation.
                </p>
              ) : (
                <p className="empty-text">
                  Action items will appear here after the conversation is
                  complete.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConversationModal />
    </div>
  );
};

export default Interpreter;

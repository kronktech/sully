import { dispatch } from "../store";
import { handleEvent } from "./webRTCEvents";
import {
  getEphemeralToken,
  setListening,
  addDetectedAction,
  setConnecting,
} from "../store/interpreterSlice";
import { monitorForWakeWord } from "./wakeWordRecognition";
import { URL } from "./server";

let dataChannel = null;
let isConnected = false;
let peerConnection = null;
let token = null;

const connect = async () => {
  if (isConnected) return;

  dispatch(setConnecting(true));

  if (token) {
    await doConnect();
  } else {
    dispatch(getEphemeralToken()).then(async (action) => {
      token = action.payload.client_secret.value;
      await doConnect();
    });
  }
};

const doConnect = async () => {
  try {
    console.log("Connecting");

    // Create peer connection
    peerConnection = new RTCPeerConnection();

    // Set up audio element for model output
    const audioEl = document.getElementById("interpreterAudio");
    audioEl.autoplay = true;

    // Handle remote audio track from model
    peerConnection.ontrack = (e) => {
      audioEl.srcObject = e.streams[0];
    };

    // Get local audio stream (microphone)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    // Add local audio track to peer connection
    peerConnection.addTrack(stream.getTracks()[0]);

    // Create data channel for events
    dataChannel = peerConnection.createDataChannel("oai-events");

    // Handle messages from the model
    dataChannel.addEventListener("message", (e) => handleEvent(e));

    // Create and set local description (offer)
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send offer to OpenAI Realtime API
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!sdpResponse.ok) {
      throw new Error("Failed to connect to OpenAI Realtime API");
    }

    // Set remote description (answer)
    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await peerConnection.setRemoteDescription(answer);

    // After connection is established, start listening
    dataChannel.onopen = () => {
      console.log("Data channel opened");
      startListening();

      dispatch(setConnecting(false));

      const activationSound = document.getElementById("activationSound");

      if (activationSound) {
        activationSound.currentTime = 0;
        activationSound
          .play()
          .catch((err) =>
            console.error("Error playing activation sound:", err)
          );
      }
    };
  } catch (error) {
    console.error("WebRTC initialization error:", error);
    dispatch(setConnecting(false));
    monitorForWakeWord();
  }
};

const startListening = () => {
  dispatch(setListening(true));

  // Update session to start audio
  const sessionUpdateEvent = {
    type: "session.update",
    session: {},
  };

  dataChannel.send(JSON.stringify(sessionUpdateEvent));
};

const disconnect = () => {
  console.log("Disconnecting");

  // Disconnect WebRTC
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  const audioEl = document.getElementById("interpreterAudio");

  audioEl.pause();
  audioEl.srcObject = null;

  isConnected = false;
  monitorForWakeWord();
};

const stopListening = () => {
  if (!dataChannel || dataChannel.readyState !== "open") return;

  console.log("Stopping listening");

  dispatch(setListening(false));

  // Clear the input audio buffer
  const clearAudioEvent = {
    type: "input_audio_buffer.clear",
  };

  dataChannel.send(JSON.stringify(clearAudioEvent));
  disconnect();
};

const requestMetadata = (transcript) => {
  console.log("Requesting metadata", dataChannel?.readyState);
  if (!dataChannel || dataChannel.readyState !== "open" || !transcript) return;

  const prompt = `Return a JSON object identifying the language of the most recent utterance from the conversation, as well as whether they were requesting a specific action from you:

Most recent utterance: "${transcript}"

The possible actions they might request are:

- Repeat the last translation
- Order a lab
- Schedule a follow-up appointment

{ "reasoning": "<One sentence explaining your reasoning for the language you identified as well as whether or not you think they are requesting a specific action from you. If it is close to English assume it is English. If it is close to Spanish (e.g. Portuguese) assume it is actually Spanish.>", "languageCode": "<3 letter language code. Must be eng, spa, or other if you think it's some other language>", "action": <"repeat"|"order_lab"|"schedule_followup"|null>, "actionDetails": "<Details of the action they are requesting, if any>" }`;
  const metadataEvent = {
    type: "response.create",
    response: {
      conversation: "none",
      metadata: { topic: "metadata" },
      modalities: ["text"],
      instructions: prompt,
    },
  };

  console.log("Sending metadata event");

  dataChannel.send(JSON.stringify(metadataEvent));
};

const requestRepeat = (translation) => {
  if (!translation) return;

  console.log("Repeating translation:", translation);

  const repeatEvent = {
    type: "response.create",
    response: {
      modalities: ["audio", "text"],
      instructions: `Repeat this translation verbatim: "${translation}"`,
    },
  };

  dataChannel.send(JSON.stringify(repeatEvent));
};

const requestAction = (metadata) => {
  console.log("Requesting action:", metadata);

  const prompt = `Make a tool/function call using ${metadata.action} based on the following recently requested action:

"${metadata.actionDetails}"`;
  const actionEvent = {
    type: "response.create",
    response: {
      conversation: "none",
      metadata: { topic: "action" },
      modalities: ["text"],
      instructions: prompt,
    },
  };

  dataChannel.send(JSON.stringify(actionEvent));
};

const handleFunctionCall = async (functionCall) => {
  const args = JSON.parse(functionCall.arguments);

  // Prepare webhook data
  let webhookData;
  if (functionCall.name === "schedule_followup") {
    webhookData = {
      type: "schedule_followup",
      createdAt: new Date().toISOString(),
      details: {
        timeframe: args.timeframe,
        reason: args.reason,
        specialty: args.specialty,
      },
    };
  } else if (functionCall.name === "order_lab") {
    webhookData = {
      type: "order_lab",
      createdAt: new Date().toISOString(),
      details: {
        test_type: args.test_type,
        urgency: args.urgency || "routine",
        instructions: args.instructions,
      },
    };
  }

  try {
    // Send to our backend proxy
    const webhookResponse = await fetch(`${URL}/api/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookData),
    });

    if (!webhookResponse.ok) {
      console.error("Webhook call failed", webhookResponse);
    }

    // Return result to model
    sendFunctionResult(functionCall.call_id, {
      success: true,
      message:
        functionCall.name === "schedule_followup"
          ? `Follow-up appointment scheduled for ${args.timeframe} from now`
          : `Lab order sent for ${args.test_type}`,
    });

    // Store action in state
    dispatch(addDetectedAction(webhookData));

    // Continue conversation
    createResponse();
  } catch (error) {
    console.error("Error executing function:", error);
    sendFunctionResult(functionCall.call_id, {
      success: false,
      error: error.message,
    });
  }
};

const sendFunctionResult = (callId, result) => {
  const functionResult = {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(result),
    },
  };

  dataChannel.send(JSON.stringify(functionResult));
};

const createResponse = () => {
  if (!dataChannel || dataChannel.readyState !== "open") return;

  const createResponse = {
    type: "response.create",
  };

  dataChannel.send(JSON.stringify(createResponse));
};

export {
  connect,
  requestAction,
  requestMetadata,
  requestRepeat,
  stopListening,
  handleFunctionCall,
};

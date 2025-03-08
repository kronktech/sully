import { dispatch } from "../store";
import { handleEvent } from "./webRTCEvents";
import {
  getEphemeralToken,
  setListening,
  addDetectedAction,
  setConnecting,
  setStopping,
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
    const model = "gpt-4o-realtime-preview-2024-12-17";
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

  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }

  peerConnection.getSenders().forEach((sender) => {
    if (sender.track) {
      sender.track.stop();
    }
  });

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
  dispatch(setStopping(true));

  // Clear the input audio buffer
  const clearAudioEvent = {
    type: "input_audio_buffer.clear",
  };

  dataChannel.send(JSON.stringify(clearAudioEvent));
  disconnect();
};

const requestTranslation = (transcriptId, transcript) => {
  console.log("Requesting translation", dataChannel?.readyState);
  if (!dataChannel || dataChannel.readyState !== "open" || !transcript) return;

  const prompt = `You are a healthcare interpreter and assistant that translates between English and Spanish. You must respond to the following utterance:

"${transcript}"

Follow these rules in prioity order:

1. If they told you to stop or that they are done, just say "Ok".
2. If they asked you to repeat something, repeat the last thing you said verbatim.
3. If they addressed directly as Sully (might sound like silly, sorry, sally, only, siri, selling, sewing, or slowly), reply directly in English. Do not translate direct requests to you!
4. If they spoke in English, translate it to Spanish. If they spoke in Spanish, translate it to English. Parrot back exactly what they said in the other language. Say EXACTLY what is said to you. Do NOT add your own commentary or explanations. Do NOT change names that are said (e.g. if they say "I'm Dr. Smith", say "Yo soy Dr. Smith" back to them). Do NOT change the wording.
5. If they spoke in a language other than Spanish or English, just say "I'm sorry, I didn't get that" in English.`;
  const metadataEvent = {
    type: "response.create",
    response: {
      conversation: "none",
      metadata: { transcriptId, topic: "translation" },
      modalities: ["audio", "text"],
      instructions: prompt,
    },
  };

  console.log("Sending translation event");

  dataChannel.send(JSON.stringify(metadataEvent));
};

const requestMetadata = (transcriptId, transcript) => {
  console.log("Requesting metadata", dataChannel?.readyState);
  if (!dataChannel || dataChannel.readyState !== "open" || !transcript) return;

  const prompt = `You are a healthcare interpreter and assistant that translates between English and Spanish. Return a JSON object identifying:
  
- **languageCode**: The languageCode of the most recent utterance from the conversation. If it is close to English assume it is English. If it is close to Spanish (e.g. Portuguese) assume it is actually Spanish.
- **actions**: A list of any actions requested by the utterance.

There are 2 types of action schemas:

- **order_lab**: The doctor wants to order a lab.
  - **schema**: { "type": "order_lab", "details": { "test_type": "<string>", "urgency": "<string>", "instructions": "<string>" } }
- **schedule_followup**: The doctor wants to schedule another appointment.
  - **schema**: { "type": "schedule_followup", "details": { "timeframe": "<string>", "reason": "<string>", "specialty": "<string>" } }

The utterance is:

"${transcript}"

Example JSON output:

{ "reasoning": "<One sentence explaining your reasoning for the language you identified as well as any action(s) you identified. >", "languageCode": "<3 letter language code. Must be eng, spa, or other if you think it's some other language>", "actions": [<The list of actions you identified. Empty list if no actions are requested.>] }`;
  const metadataEvent = {
    type: "response.create",
    response: {
      conversation: "none",
      metadata: { transcriptId, topic: "metadata" },
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

const requestAction = async (action) => {
  dispatch(
    addDetectedAction({ ...action, createdAt: new Date().toISOString() })
  );

  await fetch(`${URL}/api/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action),
  });
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
  requestTranslation,
};

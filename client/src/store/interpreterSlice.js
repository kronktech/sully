import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { URL } from "../services/server";

/**
 * Sometimes there is no translation
 * Sometimes the transcript is nonsense
 *
 */
const TIME_THRESHOLD = 1000 * 5; // 5 seconds

// Async thunk to get an ephemeral token
export const getEphemeralToken = createAsyncThunk(
  "interpreter/getEphemeralToken",
  async (voice = "alloy", { rejectWithValue }) => {
    try {
      const response = await fetch(`${URL}/api/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ voice }),
      });

      if (!response.ok) {
        throw new Error("Failed to get ephemeral token");
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Async thunk to get conversation summary
export const getSummary = createAsyncThunk(
  "interpreter/getSummary",
  async (transcripts, { rejectWithValue }) => {
    try {
      const response = await fetch(`${URL}/api/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcripts }),
      });

      if (!response.ok) {
        throw new Error("Failed to get conversation summary");
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Async thunk to save a conversation
export const saveConversation = createAsyncThunk(
  "interpreter/saveConversation",
  async (conversationData, { rejectWithValue }) => {
    try {
      const response = await fetch(`${URL}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(conversationData),
      });

      if (!response.ok) {
        throw new Error("Failed to save conversation");
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Add new thunk for fetching conversations
export const fetchConversations = createAsyncThunk(
  "interpreter/fetchConversations",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${URL}/api/conversations`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }
      return await response.json();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  isListening: false,
  isConnecting: false,
  transcripts: [],
  transcriptMetadata: [],
  translations: [],
  error: null,
  detectedActions: [],
  summary: null,
  conversations: [],
  showConversationModal: false,
};

const interpreterSlice = createSlice({
  name: "interpreter",
  initialState,
  reducers: {
    addTranscript: (state, action) => {
      if (state.transcriptMetadata.length >= state.transcripts.length + 1) {
        action.payload = {
          ...action.payload,
          ...state.transcriptMetadata[state.transcriptMetadata.length - 1],
          hasMetadata: true,
        };
      }

      if (state.translations.length >= state.transcripts.length + 1) {
        action.payload = {
          ...action.payload,
          ...state.translations[state.translations.length - 1],
          hasTranslation: true,
        };
      }

      console.log("Transcript payload:", action.payload);

      state.transcripts.push(action.payload);
    },
    addTranscriptMetadata: (state, action) => {
      state.transcriptMetadata.push(action.payload);

      if (state.transcripts.length >= state.transcriptMetadata.length) {
        state.transcripts[state.transcripts.length - 1] = {
          ...state.transcripts[state.transcripts.length - 1],
          ...action.payload,
          hasMetadata: true,
        };
      }

      console.log(
        "Transcript metadata added:",
        state.transcripts[state.transcripts.length - 1]
      );
    },
    addTranslation: (state, action) => {
      state.translations.push(action.payload);

      if (state.transcripts.length >= state.translations.length) {
        state.transcripts[state.transcripts.length - 1] = {
          ...state.transcripts[state.transcripts.length - 1],
          ...action.payload,
          hasTranslation: true,
        };
      }

      console.log(
        "Transcript translation added:",
        state.transcripts[state.transcripts.length - 1]
      );
    },
    clearTranscripts: (state) => {
      state.transcripts = [];
      state.transcriptMetadata = [];
      state.translations = [];
      state.detectedActions = [];
      state.summary = null;
    },
    addDetectedAction: (state, action) => {
      state.detectedActions.push(action.payload);
    },
    setDetectedActions: (state, action) => {
      state.detectedActions = action.payload;
    },
    setListening: (state, action) => {
      state.isListening = action.payload;
    },
    setConnecting: (state, action) => {
      state.isConnecting = action.payload;
    },
    setSummary: (state, action) => {
      state.summary = action.payload;
    },
    setShowConversationModal: (state, action) => {
      state.showConversationModal = action.payload;
    },
    loadConversation: (state, action) => {
      const { transcript, summary, actions } = action.payload;
      state.transcripts = transcript;
      state.transcriptMetadata = transcript.map((t) => ({
        role: t.role,
        languageCode: t.languageCode,
        createdAt: t.createdAt,
      }));
      state.translations = transcript.map((t) => t.translation);
      state.summary = summary;
      state.detectedActions = actions;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getEphemeralToken.pending, (state) => {
        state.error = null;
      })
      .addCase(getEphemeralToken.fulfilled, (state, action) => {
        state.sessionToken = action.payload.client_secret.value;
      })
      .addCase(getEphemeralToken.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(getSummary.pending, (state) => {
        state.error = null;
      })
      .addCase(getSummary.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(saveConversation.pending, (state) => {
        state.error = null;
      })
      .addCase(saveConversation.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(fetchConversations.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const {
  addDetectedAction,
  addTranscript,
  addTranscriptMetadata,
  addTranslation,
  clearTranscripts,
  setListening,
  setConnecting,
  setSummary,
  setDetectedActions,
  setShowConversationModal,
  loadConversation,
} = interpreterSlice.actions;

export default interpreterSlice.reducer;

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { URL } from "../services/server";

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
  isStopping: false,
};

const interpreterSlice = createSlice({
  name: "interpreter",
  initialState,
  reducers: {
    addTranscript: (state, action) => {
      state.transcripts.push(action.payload);
    },
    addTranscriptMetadata: (state, action) => {
      const transcript = state.transcripts.find(
        (transcript) => transcript.id === action.payload.id
      );

      Object.keys(action.payload).forEach((key) => {
        transcript[key] = action.payload[key];
      });

      transcript.hasMetadata = true;
    },
    addTranslation: (state, action) => {
      const transcript = state.transcripts.find(
        (transcript) => transcript.id === action.payload.id
      );

      Object.keys(action.payload).forEach((key) => {
        transcript[key] = action.payload[key];
      });

      transcript.hasTranslation = true;
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
      console.log("Loading conversation:", action.payload);
      state.transcripts = transcript.map((transcript) => ({
        ...transcript,
        hasMetadata: true,
        hasTranslation: true,
      }));
      state.transcriptMetadata = transcript.map((t) => ({
        role: t.role,
        languageCode: t.languageCode,
        createdAt: t.createdAt,
      }));
      state.translations = transcript.map((t) => t.translation);
      state.summary = summary;
      state.detectedActions = actions;
    },
    setStopping: (state, action) => {
      state.isStopping = action.payload;
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
  setStopping,
} = interpreterSlice.actions;

export default interpreterSlice.reducer;

# Project

I am a Senior Software Engineer doing a 4 hour interview project for a company called sully.ai which makes AI agents for healthcare. This is the project spec they have given me:

## [Hackathon Project] Interpreter End-to-End Proof-of-Concept

**Problem**:
Non-english speaking patients are unable to communicate with clinicians who cannot speak the patients’ language. Providers are required to hire in-person or virtual interpreters.

**Goals**:
Build a web-based Language Interpreter agent designed for an **_in-person_** visit that can:

- interpret between the clinician (English-speaking) and the patient (Spanish-speaking), using speech input and output
- support special inputs such as the patient saying “repeat that”, which should repeat the doctor’s previous sentence.
- At the end of the conversation, provide a summary of the conversation along with these actions if detected during the conversation: schedule followup appointment, send lab order.
- Add and use [tools](https://alnutile.medium.com/what-are-tools-in-the-scope-of-llms-and-why-are-they-so-important-f57f76190e58) to execute the actions (use https://webhook.site/ to simulate calling an action)
- Store the full conversation and the summary in a database

**NOTE: Utilize AI coding tools to develop the proof-of-concept if possible (Copilot or Cursor or similar)**

**Stack**:
Use the following stack:

- Use [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) (WebRTC or Websockets) as the core engine for the Interpreter
- ReactJS frontend: Use ReactJS in a principled manner:
  - Use of state management solution (e.g. redux)
  - Use of React routers
  - Design reusable React components
- Node or Python server
- Pick your own database
- Host on GCP/Vercel (or your choice of hosting solution)

**Deliverables**:

- Document the list of features you chose to build and why: provide product rationale
- Proof-of-concept: A functional prototype that enables communication between English and Spanish
  - A feature complete UI
  - Text-to-speech output for each utterance
  - Display both sides of the conversation in English
  - Display summary of the conversation
  - Store the conversation and the summary in a database
  - Display recognized intents/actions (listed above under Goals) along with their metadata
  - Execute actions using tools (use https://webhook.site/)
- Technical Design Doc that captures your thought process

**Resources**:

- [OpenAI APIs](https://platform.openai.com/docs/overview)
- [What are Tools?](https://alnutile.medium.com/what-are-tools-in-the-scope-of-llms-and-why-are-they-so-important-f57f76190e58)

## Additional Context

sully.ai has also provided the following context in the email containing the project spec:

While the document doesn’t explicitly state this, the team strongly prefers a hands-free translator over one that requires clicking a button to start.

PS - Here are some notes I've collected that may be helpful for you to look at from previous Hackathon Debriefs.

**Debrief Take-aways**

**Challenges during live demo**:

- Technical issues with audio sharing during the demo
- Occasional unexpected responses to non-target languages
- Identify opportunities to reduce initial setup complexity by focusing on core - functionality first
- Multiple voice outputs occurred simultaneously, indicating potential queue management need
- Requiring both audio and video permissions unexpectedly
- Complex event stream parsing needed

**BIG PLUS**:

- App detects speaker's language automatically to determine doctor/patient roles

**Core requirements**:

- Speech-in to speech-out translation between languages
- Support for "repeat that" command functionality
- Generate visit summaries and trigger follow-up actions

**Good**:

- The application displays conversation history and generates a summary with action items at the end of the conversation
- Implementing webhook integration to demonstrate tool calling for tasks like scheduling lab tests and follow-up appointments
- Implementing structured parsing for medical orders like lab tests and appointments

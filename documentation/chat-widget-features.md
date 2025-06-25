# Chat Widget Features

## Model Selection

The chat widget now includes a dropdown menu that allows users to select between different AI models:

### Available Models

1. **Llama 4 (67GB - High Quality)**
   - Default model
   - Best for complex regulatory analysis
   - Requires GPU with 24GB+ VRAM
   - Slower response times but highest quality

2. **Llama 3.2 (2GB - Fast)**
   - Lightweight alternative
   - Faster response times
   - Can run on lower-end hardware
   - Good for quick questions and basic analysis

### How to Use

1. Open the chat widget by clicking the chat button in the bottom right
2. Look for the "AI Model" dropdown at the top of the chat panel
3. Select your preferred model from the dropdown
4. The selected model will be used for all subsequent messages in the conversation

### Model Switching Behavior

- When you switch models during an active conversation:
  - The chat will display a message: "Switching to [model name]. The conversation will restart with the new model."
  - The conversation history is preserved but the context is reinitialized
  - The new model will re-analyze the title structure when you send your next message
  - This ensures the new model is properly initialized with the document context

## Stop Generation Feature

Users can now stop ongoing AI analysis by clicking the "Stop" button that appears while the AI is generating a response.

### How It Works

1. When you send a message, a loading indicator appears with "Analyzing..."
2. A "Stop" button appears next to the loading indicator
3. Click the "Stop" button to cancel the current generation
4. The chat will show "Response generation was stopped." message
5. You can immediately send a new message or switch models

### Use Cases

- Stop long-running analyses that are taking too long
- Cancel a request if you realize you want to ask something different
- Quickly switch between models without waiting for the current one to finish

## Navigation Behavior

When navigating between different titles:
- The chat conversation is automatically cleared
- The chat context is reset for the new title
- This ensures each title gets a fresh analysis without confusion from previous conversations
- The chat widget will re-initialize with the new title's context when opened

## Context Initialization

When the chat opens for a title:
- The system first finds the main title document (type: 'title')
- Fetches the complete content using the document-specific API endpoint
- All HTML formatting is stripped to provide plain text
- The complete text is provided to the AI model as context
- This allows the AI to have comprehensive knowledge of the entire regulation
- For very large titles, content may be truncated to stay within token limits (approximately 50,000 characters)

## Technical Implementation

### Frontend Changes

- Added model selection state management
- Implemented axios cancel tokens for request cancellation
- Updated UI to show model selector and stop button
- Added proper error handling for cancelled requests

### Backend Compatibility

- The backend already supports dynamic model selection via the `model` parameter
- No backend changes were required for these features

### Model Initialization

- Both llama4 and llama3.2 models are now downloaded and initialized on container startup
- This ensures fast switching between models without download delays

## Configuration

To add more models or change available models:

1. Edit `/services/frontend/components/ChatWidget.tsx` and update the `availableModels` array
2. Edit `/services/model-runner/init-model.sh` to pull any additional models on startup
3. Rebuild and redeploy the frontend and model-runner services
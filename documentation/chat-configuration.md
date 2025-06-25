# Chat Configuration

The chat functionality can be configured through environment variables in the `.env` file.

## Environment Variables

### CHAT_SYSTEM_PROMPT
- **Description**: The system prompt that sets the AI assistant's behavior and expertise
- **Default**: "You are an expert at analyzing federal regulations. Your goal is to help the user understand what they are reading. As a secondary goal you are to help the user identify where the potential for deregulatory action could be taken."
- **Usage**: Customize this to change the AI's personality, focus, or expertise

Example:
```env
CHAT_SYSTEM_PROMPT="You are a helpful assistant specializing in U.S. federal regulations, with expertise in compliance and regulatory analysis."
```

### CHAT_DEFAULT_MODEL
- **Description**: The default AI model to use for chat
- **Default**: `llama4`
- **Options**: `llama4`, `llama3.2`
- **Usage**: Set the default model that will be selected when users open the chat

Example:
```env
CHAT_DEFAULT_MODEL=llama3.2
```

### CHAT_TIMEOUT_SECONDS
- **Description**: Maximum time in seconds to wait for AI responses
- **Default**: `120` (2 minutes)
- **Usage**: Increase for slower models or decrease for faster response requirements

Example:
```env
CHAT_TIMEOUT_SECONDS=180
```

## How It Works

1. **Backend Service**: 
   - Reads environment variables on startup
   - Provides `/api/chat/config` endpoint for frontend to fetch configuration
   - Uses configured timeout for model API calls

2. **Frontend Service**:
   - Fetches configuration from backend on component mount
   - Uses configured system prompt for all conversations
   - Sets default model selection
   - Applies timeout to all chat API requests

## Applying Changes

After modifying the `.env` file:

```bash
# Restart the services to apply new configuration
docker-compose down backend frontend
docker-compose up -d backend frontend
```

## Custom System Prompts Examples

### Compliance Focus
```env
CHAT_SYSTEM_PROMPT="You are a compliance expert helping users understand federal regulations. Focus on identifying requirements, obligations, and potential compliance risks. Highlight key dates, deadlines, and mandatory actions."
```

### Business Impact Focus
```env
CHAT_SYSTEM_PROMPT="You are a business analyst specializing in regulatory impact. Help users understand how federal regulations affect business operations, costs, and opportunities. Identify administrative burdens and suggest efficiency improvements."
```

### Legal Analysis Focus
```env
CHAT_SYSTEM_PROMPT="You are a legal expert analyzing federal regulations. Provide detailed interpretations, identify ambiguities, and explain the legal implications. Reference relevant statutory authority and precedents where applicable."
```

## Notes

- System prompts should be enclosed in quotes in the `.env` file
- Changes require service restart to take effect
- The chat widget fetches configuration once on mount, so users need to refresh the page to see changes
- Model availability depends on what's installed in the model-runner service
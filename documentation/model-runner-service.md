# Model Runner Service Documentation

## Overview

The Model Runner service provides AI-powered chat capabilities for the eCFR Navigator using Ollama to run large language models. By default, it runs the Llama 4 model (67GB) with GPU acceleration for optimal performance.

## Hardware Requirements

### GPU Mode (Default)
- **NVIDIA GPU** with CUDA support
- **Minimum GPU Memory**: 24GB VRAM (for Llama 4)
- **Recommended**: NVIDIA RTX 4090, A5000, or better
- **Driver**: NVIDIA driver with CUDA 12.0+ support
- **Docker**: NVIDIA Container Toolkit installed

### CPU Mode
- **RAM**: At least 70GB available RAM for Llama 4
- **CPU**: Modern multi-core processor (8+ cores recommended)
- **Note**: CPU mode is significantly slower than GPU mode

## Configuration

### Environment Variables

The model-runner service can be configured through environment variables in `docker-compose.yml`:

```yaml
environment:
  OLLAMA_HOST: 0.0.0.0           # Bind to all interfaces
  OLLAMA_NUM_GPU: 999            # Use all available GPU layers (GPU mode)
  # OLLAMA_NUM_GPU: 0            # Uncomment for CPU-only mode
```

### Switching Between GPU and CPU Mode

#### To use CPU mode:

1. Edit `docker-compose.yml` and modify the model-runner service:

```yaml
model-runner:
  environment:
    OLLAMA_HOST: 0.0.0.0
    OLLAMA_NUM_GPU: 0  # Force CPU mode
  # Comment out or remove the deploy section:
  # deploy:
  #   resources:
  #     reservations:
  #       devices:
  #         - driver: nvidia
  #           count: all
  #           capabilities: [gpu]
```

2. Restart the service:
```bash
docker-compose down model-runner
docker-compose up -d model-runner
```

#### To use GPU mode (default):

Ensure the deploy section is present and `OLLAMA_NUM_GPU` is set to 999 or removed.

## Changing Models

### Available Models

1. **Llama 4**: 67GB model, highest quality responses
2. **Llama 3.2** (default): 2GB model, faster responses

### Switching to Llama 3.2

1. Edit `/services/model-runner/init-model.sh` and replace all instances of `llama4` with `llama3.2`:

```bash
# Change from:
if ! ollama list | grep -q "llama4"; then
    echo "Pulling llama4 model..."
    ollama pull llama4

# To:
if ! ollama list | grep -q "llama3.2"; then
    echo "Pulling llama3.2 model..."
    ollama pull llama3.2
```

2. Update the backend chat service to use the new model by editing `/services/backend/routes/chat.js`:

```javascript
// Change from:
const { messages, model = 'llama4' } = req.body;

// To:
const { messages, model = 'llama3.2' } = req.body;
```

3. Rebuild and restart:
```bash
docker-compose build model-runner backend
docker-compose down model-runner backend
docker-compose up -d model-runner backend
```

### Hardware Requirements by Model

| Model | GPU Memory | System RAM (GPU mode) | System RAM (CPU mode) |
|-------|------------|----------------------|---------------------|
| Llama 4 | 24GB+ | 8GB | 70GB+ |
| Llama 3.2 | 2GB+ | 4GB | 4GB+ |

## Initialization Behavior

The model-runner service automatically:
1. Downloads both llama3.2 and llama4 models if not present
2. Loads both models into memory (GPU or CPU) on startup in parallel
3. Runs test inferences to ensure both models are ready
4. Provides an OpenAI-compatible API endpoint

This prevents the first chat request from experiencing long delays and allows instant switching between models.

## API Endpoint

The service provides an OpenAI-compatible chat completions endpoint:
- **URL**: `http://localhost:11434/v1/chat/completions`
- **Method**: POST
- **Timeout**: 120 seconds (configurable in backend service)

## Troubleshooting

### GPU Not Detected

1. Verify NVIDIA drivers are installed:
```bash
nvidia-smi
```

2. Ensure NVIDIA Container Toolkit is installed:
```bash
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

### Out of Memory Errors

For Llama 4:
- Ensure you have a GPU with at least 24GB VRAM
- Close other GPU-intensive applications
- Consider using Llama 3.2 for smaller hardware

### Slow Response Times

- CPU mode is 10-50x slower than GPU mode
- First request after startup may be slower as model loads
- Consider using a smaller model like Llama 3.2

### Model Download Issues

If model download fails:
1. Check internet connectivity
2. Manually pull the model:
```bash
docker exec -it ecfr-model-runner ollama pull llama4
```

## Performance Optimization

1. **Use GPU acceleration** whenever possible
2. **Pre-load models** on startup (default behavior)
3. **Allocate sufficient resources** in Docker Desktop settings
4. **Monitor GPU usage** with `nvidia-smi` during inference
5. **Consider model quantization** for memory-constrained systems

## Security Considerations

- The model runner binds to all interfaces (0.0.0.0) by default
- In production, consider restricting to localhost only
- No authentication is built into Ollama; rely on network security
- Models may generate inappropriate content; implement content filtering as needed
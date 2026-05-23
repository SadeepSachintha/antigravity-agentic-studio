# Antigravity Agentic Studio 🔮

A state-of-the-art interactive workspace for creating, testing, and visualizing **Google Antigravity SDK** agents in real-time. 

Built with a lightweight **Python FastAPI** backend and a premium, responsive **Vanilla HTML5/CSS3/JS** frontend leveraging modern glassmorphic design and smooth micro-animations.

---

## ✨ Features

* **Sleek Glassmorphic UI:** A dark-mode layout styled with neon gradients, custom scrollbars, active HUD status indicators, and modern typography (*Outfit* & *Space Mono*).
* **Live Thought Streaming:** Watch the agent's internal reasoning process (`thoughts` generator) stream dynamically in collapsible brain-icon logs before the final response is displayed.
* **Persona Shaping:** Configure custom system instructions on-the-fly inside the control sidebar.
* **Flexible Model Select:** Instantly switch between `gemini-3.5-flash`, `gemini-1.5-flash`, and `gemini-1.5-pro` models.
* **Zero Node.js Overhead:** Serves complete static frontend assets straight from the Python FastAPI server.

---

## 🚀 Installation & Setup

### Prerequisites
* Python 3.10 or higher (Optimized for Python 3.14+)
* A Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/api-keys)

### Step 1: Add Credentials
Clone this repository locally, then open the `.env` file and replace the placeholder with your actual Gemini API Key:
```env
GEMINI_API_KEY=your_actual_api_key_from_ai_studio
```

### Step 2: One-Click Launch
Run the automated startup script in your terminal. It will initialize a local virtual environment (`.venv`), install requirements, and boot up the server:
```bash
chmod +x run.sh
./run.sh
```

Once the script completes, open your browser and navigate to:
```
http://localhost:8000
```

---

## 🛠️ Project Structure

```
antigravity-agentic-studio/
├── .env                  # Environment configurations (Credentials)
├── requirements.txt      # Python dependencies (FastAPI, AGY SDK, etc.)
├── main.py               # FastAPI backend with streaming SSE chat handler
├── run.sh                # Setup and execution shell script
├── README.md             # Repository documentation
└── static/               # Single-page frontend app assets
    ├── index.html        # Semantic HTML layout
    ├── style.css         # Custom stylesheet (Glassmorphic theme)
    └── script.js         # Client-side EventSource/Stream handler
```

---

## 🛡️ License

This project is licensed under the Apache-2.0 License - see the [Google Antigravity SDK](https://github.com/google) terms for additional SDK information.

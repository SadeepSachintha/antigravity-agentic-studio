# Antigravity Agentic Studio 🔮

A state-of-the-art interactive workspace for creating, testing, and visualizing **Google Antigravity SDK** agents in real-time. 

Built with a lightweight **Python FastAPI** backend and a premium, responsive **Vanilla HTML5/CSS3/JS** frontend leveraging modern glassmorphic design and smooth micro-animations.

---

## ✨ Features

* **Cooperative Agent Writing Room ✍️:** A state-of-the-art space where 4 specialized Google Antigravity AI agents collaborate sequentially and in refinement loops to plan, research, compile, audit, and perfect complex documents.
  * **Orchestrator Agent:** Outlines structure and formulates targeted research focus.
  * **Researcher Agent:** Equipped with a custom non-blocking scraper executing real web searches on DuckDuckGo.
  * **Drafting Agent:** Compiles outlines and research notes into structured markdown.
  * **Critic Agent:** Audits correctness, style guides, and formats against checkable guidelines.
* **Interactive Human-in-the-Loop Review Panel:** A premium split-screen dashboard displaying:
  * **Document Preview:** Beautiful, styled live markdown rendering on-the-fly.
  * **Agent Logs:** A transparent transcript record showing the conversations between agents.
* **Revision & Feedback Recursion:** Type custom revision requests and send them back to the drafting and critic agents for continuous, iterative refinement.
* **Instant Export & Approve:** Saves finalized approved documents to local workspace storage and triggers automated browser file downloads.
* **Sleek Glassmorphic UI:** A dark-mode layout styled with neon gradients, visual timeline stepper indicators, active HUD status card, and modern typography (*Outfit* & *Space Mono*).
* **Live Thought Streaming:** Watch the agent's internal reasoning process (`thoughts` generator) stream dynamically in collapsible brain-icon logs before the final response is displayed.
* **Persona Shaping:** Configure custom system instructions on-the-fly inside the control sidebar.
* **Flexible Model Select:** Instantly switch between `gemini-3.5-flash` (hyper-fast) and `gemini-1.5-pro` (high thoroughness) model variations.
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
├── requirements.txt      # Python dependencies (FastAPI, AGY SDK, BS4, etc.)
├── main.py               # FastAPI backend with streaming SSE chat & Writing Room handlers
├── run.sh                # Setup and execution shell script
├── README.md             # Repository documentation
└── static/               # Single-page frontend app assets
    ├── index.html        # Tabbed glassmorphic layout
    ├── style.css         # Styling stylesheet (Neon timeline & agent bubbles)
    ├── script.js         # Client orchestration, SSE readers & markdown parsers
    └── documents/        # Output folder for approved Markdown files
```

---

## 🛡️ License

This project is licensed under the Apache-2.0 License - see the [Google Antigravity SDK](https://github.com/google) terms for additional SDK information.


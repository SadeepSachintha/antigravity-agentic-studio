/* ==========================================================================
   ANTIGRAVITY AGENTIC STUDIO - FRONTEND ORCHESTRATOR
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // --- UI Element Selectors ---
    const sidebar = document.getElementById("sidebar-panel");
    const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
    const clearChatBtn = document.getElementById("clear-chat-btn");
    const chatFeed = document.getElementById("chat-feed");
    const welcomeCard = document.getElementById("welcome-card");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    
    // Config controls
    const modelSelect = document.getElementById("model-select");
    const systemInstructions = document.getElementById("system-instructions");
    
    // Status HUD
    const statusCard = document.getElementById("status-card");
    const statusLabel = document.getElementById("status-label");
    const statusDesc = document.getElementById("status-desc");

    // --- State Variables ---
    let isGenerating = false;

    // --- Initialize Application ---
    checkBackendStatus();
    setupEventListeners();

    // --- 1. Backend Connectivity & Status ---
    async function checkBackendStatus() {
        try {
            const res = await fetch("/api/status");
            if (!res.ok) throw new Error("Server responded with error status");
            
            const data = await res.json();
            
            if (data.status === "healthy") {
                statusCard.className = "status-card success";
                statusLabel.textContent = "System Fully Ready";
                statusDesc.innerHTML = 'Antigravity SDK loaded. <strong>GEMINI_API_KEY</strong> detected in env.';
            } else {
                statusCard.className = "status-card error";
                statusLabel.textContent = "API Key Required";
                statusDesc.innerHTML = 'Placeholder or empty key found. Please open <strong>.env</strong> in your workspace and add a valid <code>GEMINI_API_KEY</code>.';
            }
        } catch (err) {
            statusCard.className = "status-card error";
            statusLabel.textContent = "Offline";
            statusDesc.textContent = "Could not reach local server. Run the startup script (run.sh) in your terminal.";
        }
    }

    // --- 2. Event Handlers & Bindings ---
    function setupEventListeners() {
        // Toggle Sidebar
        toggleSidebarBtn.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
        });

        // Clear Chat
        clearChatBtn.addEventListener("click", clearChat);

        // Auto-growing Textarea Input
        chatInput.addEventListener("input", () => {
            chatInput.style.height = "auto";
            chatInput.style.height = (chatInput.scrollHeight) + "px";
        });

        // Enter submits the form (Shift+Enter inserts newline)
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chatForm.requestSubmit();
            }
        });

        // Click suggested prompts
        document.querySelectorAll(".suggested-prompt-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const prompt = btn.getAttribute("data-prompt");
                chatInput.value = prompt;
                chatInput.style.height = "auto";
                chatForm.requestSubmit();
            });
        });

        // Submit message form
        chatForm.addEventListener("submit", handleFormSubmit);
    }

    // --- 3. Chat Session Mechanics ---
    function clearChat() {
        if (isGenerating) return; // Prevent clearing while agent is running
        
        // Remove all messages except the welcome card
        const messages = chatFeed.querySelectorAll(".msg-wrapper, .thought-container");
        messages.forEach(el => el.remove());
        
        // Restore welcome card
        welcomeCard.style.display = "flex";
        chatInput.value = "";
        chatInput.style.height = "auto";
        checkBackendStatus();
    }

    function scrollFeedToBottom() {
        chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    // --- 4. SSE Chat Stream Handler ---
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const promptText = chatInput.value.trim();
        if (!promptText || isGenerating) return;
        
        isGenerating = true;
        sendBtn.disabled = true;
        chatInput.disabled = true;
        
        // Hide welcome card if open
        welcomeCard.style.display = "none";
        
        // 1. Render User Message
        renderUserMessage(promptText);
        chatInput.value = "";
        chatInput.style.height = "auto";
        scrollFeedToBottom();

        // 2. Render Loading/Response State
        const loader = renderLoaderBubble();
        scrollFeedToBottom();

        // Containers for current session
        let thoughtContainer = null;
        let thoughtBody = null;
        let thoughtTextAccumulator = "";
        
        let agentBubble = null;
        let agentTextAccumulator = "";

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: promptText,
                    model: modelSelect.value,
                    system_instructions: systemInstructions.value
                })
            });

            if (!response.ok) throw new Error("Failed to communicate with server");

            // Read the stream chunk-by-chunk using fetch reader
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            loader.remove(); // Remove loading bubble once connection is made

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const rawText = decoder.decode(value);
                const lines = rawText.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const payloadStr = line.substring(6).trim();
                        if (payloadStr === "[DONE]") continue;

                        try {
                            const payload = JSON.parse(payloadStr);

                            // Scenario A: STREAMING THOUGHTS
                            if (payload.type === "thought") {
                                // Lazy create thought container
                                if (!thoughtContainer) {
                                    const parsed = createThoughtContainer();
                                    thoughtContainer = parsed.container;
                                    thoughtBody = parsed.body;
                                    chatFeed.appendChild(thoughtContainer);
                                }
                                
                                thoughtTextAccumulator += payload.content;
                                thoughtBody.textContent = thoughtTextAccumulator;
                                scrollFeedToBottom();
                            }
                            
                            // Scenario B: STREAMING RESPONSE TOKENS
                            else if (payload.type === "token") {
                                // Lazy create agent bubble container
                                if (!agentBubble) {
                                    agentBubble = createAgentBubble();
                                    chatFeed.appendChild(agentBubble);
                                }
                                
                                agentTextAccumulator += payload.content;
                                // Simple dynamic markdown rendering
                                agentBubble.querySelector(".msg-bubble").innerHTML = renderMarkdown(agentTextAccumulator);
                                scrollFeedToBottom();
                            }
                            
                            // Scenario C: ERRORS DURING STREAM
                            else if (payload.type === "error") {
                                renderErrorBubble(payload.content);
                                scrollFeedToBottom();
                            }
                        } catch (jsonErr) {
                            console.error("Failed to parse SSE payload", jsonErr);
                        }
                    }
                }
            }

        } catch (err) {
            loader.remove();
            renderErrorBubble(`Network error: ${err.message}. Ensure your backend server is running.`);
            scrollFeedToBottom();
        } finally {
            isGenerating = false;
            sendBtn.disabled = false;
            chatInput.disabled = false;
            chatInput.focus();
        }
    }

    // --- 5. Custom Dynamic DOM Creators ---
    function renderUserMessage(text) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const wrapper = document.createElement("div");
        wrapper.className = "msg-wrapper user";
        wrapper.innerHTML = `
            <div class="msg-meta">You <span class="time">${time}</span></div>
            <div class="msg-bubble">${escapeHTML(text)}</div>
        `;
        chatFeed.appendChild(wrapper);
    }

    function renderLoaderBubble() {
        const wrapper = document.createElement("div");
        wrapper.className = "msg-wrapper agent";
        wrapper.innerHTML = `
            <div class="msg-meta">Agent <i class="fa-solid fa-spinner fa-spin"></i></div>
            <div class="msg-bubble loading-bubble">
                <div class="loading-dots">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>
            </div>
        `;
        chatFeed.appendChild(wrapper);
        return wrapper;
    }

    function createThoughtContainer() {
        const container = document.createElement("div");
        container.className = "thought-container";
        
        const header = document.createElement("div");
        header.className = "thought-header";
        header.innerHTML = `
            <div class="thought-title-wrapper">
                <i class="fa-solid fa-brain brain-icon"></i>
                <span>Reasoning Process</span>
            </div>
            <i class="fa-solid fa-chevron-up chevron-icon"></i>
        `;
        
        const body = document.createElement("div");
        body.className = "thought-body";
        body.textContent = "Starting thought generation...";
        
        header.addEventListener("click", () => {
            container.classList.toggle("collapsed");
        });
        
        container.appendChild(header);
        container.appendChild(body);
        
        return { container, body };
    }

    function createAgentBubble() {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const wrapper = document.createElement("div");
        wrapper.className = "msg-wrapper agent";
        wrapper.innerHTML = `
            <div class="msg-meta">Agent <span class="time">${time}</span></div>
            <div class="msg-bubble"></div>
        `;
        return wrapper;
    }

    function renderErrorBubble(errMsg) {
        const wrapper = document.createElement("div");
        wrapper.className = "msg-wrapper agent";
        wrapper.innerHTML = `
            <div class="msg-meta">System Error</div>
            <div class="msg-bubble error-bubble">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${escapeHTML(errMsg)}</span>
            </div>
        `;
        chatFeed.appendChild(wrapper);
    }

    // --- 6. Helper Utilities ---
    function escapeHTML(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // A lightweight, highly efficient Markdown regex parser for browser rendering
    function renderMarkdown(mdText) {
        let html = escapeHTML(mdText);

        // 1. Triple backtick code blocks: ```lang ... ```
        html = html.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        // 2. Inline code: `code`
        html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

        // 3. Bold tags: **bold**
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

        // 4. Linebreaks
        html = html.replace(/\n/g, "<br>");

        return html;
    }
});

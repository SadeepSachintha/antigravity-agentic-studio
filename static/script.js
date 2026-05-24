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

    // --- 7. COLLABORATIVE WRITING ROOM CONTROLLER ---
    
    // Selectors
    const tabSandboxBtn = document.getElementById("tab-sandbox-btn");
    const tabWritingBtn = document.getElementById("tab-writing-btn");
    const sandboxControls = document.getElementById("sandbox-controls");
    const writingControls = document.getElementById("writing-controls");
    const chatArena = document.getElementById("chat-arena");
    const writingArena = document.getElementById("writing-arena");
    const toggleSidebarBtnWriting = document.getElementById("toggle-sidebar-btn-writing");
    
    // Writing Controls & Feeds
    const writingTopic = document.getElementById("writing-topic");
    const writingDocType = document.getElementById("writing-doc-type");
    const writingStyle = document.getElementById("writing-style");
    const writingModel = document.getElementById("writing-model");
    const startWritingBtn = document.getElementById("start-writing-btn");
    const writingActivityFeed = document.getElementById("writing-activity-feed");
    const writingReviewPane = document.getElementById("writing-review-pane");
    
    // Review Pane selectors
    const approveDocBtn = document.getElementById("approve-doc-btn");
    const reviewTabPreview = document.getElementById("review-tab-preview");
    const reviewTabTranscript = document.getElementById("review-tab-transcript");
    const reviewPreviewSection = document.getElementById("review-preview-section");
    const reviewTranscriptSection = document.getElementById("review-transcript-section");
    const revisionFeedbackInput = document.getElementById("revision-feedback-input");
    const requestRevisionBtn = document.getElementById("request-revision-btn");
    
    // Multi-agent state
    let activeWritingSession = false;
    let statePlan = "";
    let stateFindings = "";
    let stateDraft = "";
    let stateCritique = "";
    
    // Setup Writing Room Event Listeners
    setupWritingRoomListeners();
    
    function setupWritingRoomListeners() {
        // Tab switching
        tabSandboxBtn.addEventListener("click", () => {
            if (activeWritingSession) return;
            tabSandboxBtn.classList.add("active");
            tabWritingBtn.classList.remove("active");
            sandboxControls.style.display = "block";
            writingControls.style.display = "none";
            chatArena.style.display = "flex";
            writingArena.style.display = "none";
        });
        
        tabWritingBtn.addEventListener("click", () => {
            if (activeWritingSession) return;
            tabWritingBtn.classList.add("active");
            tabSandboxBtn.classList.remove("active");
            writingControls.style.display = "block";
            sandboxControls.style.display = "none";
            writingArena.style.display = "flex";
            chatArena.style.display = "none";
        });
        
        // Sidebar toggle in writing mode
        toggleSidebarBtnWriting.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
        });
        
        // Launch multi-agent collaboration
        startWritingBtn.addEventListener("click", () => {
            startMultiAgentCollaboration(false);
        });
        
        // Human feedback revision
        requestRevisionBtn.addEventListener("click", () => {
            startMultiAgentCollaboration(true);
        });
        
        // Document Approval
        approveDocBtn.addEventListener("click", approveAndDownloadDocument);
        
        // Review Pane Tabs
        reviewTabPreview.addEventListener("click", () => {
            reviewTabPreview.classList.add("active");
            reviewTabTranscript.classList.remove("active");
            reviewPreviewSection.style.display = "block";
            reviewTranscriptSection.style.display = "none";
        });
        
        reviewTabTranscript.addEventListener("click", () => {
            reviewTabTranscript.classList.add("active");
            reviewTabPreview.classList.remove("active");
            reviewTranscriptSection.style.display = "block";
            reviewPreviewSection.style.display = "none";
        });
    }
    
    async function startMultiAgentCollaboration(isRevision = false) {
        const topic = writingTopic.value.trim();
        if (!topic) {
            alert("Please enter a topic or prompt for the writing studio.");
            writingTopic.focus();
            return;
        }
        
        const feedback = revisionFeedbackInput.value.trim();
        if (isRevision && !feedback) {
            alert("Please enter revision guidelines or comments.");
            revisionFeedbackInput.focus();
            return;
        }
        
        // Lock UI
        activeWritingSession = true;
        setWritingUILocked(true);
        
        // Reset/Setup board
        if (!isRevision) {
            writingActivityFeed.innerHTML = "";
            writingReviewPane.style.display = "none";
            statePlan = "";
            stateFindings = "";
            stateDraft = "";
            stateCritique = "";
        } else {
            // Append revision marker in log
            const divider = document.createElement("div");
            divider.className = "search-event-log";
            divider.style.borderColor = "rgba(168, 85, 247, 0.3)";
            divider.style.color = "#d8b4fe";
            divider.innerHTML = `<i class="fa-solid fa-rotate-left"></i> Revision Requested: <strong>"${escapeHTML(feedback)}"</strong>`;
            writingActivityFeed.appendChild(divider);
            writingActivityFeed.scrollTop = writingActivityFeed.scrollHeight;
        }
        
        // Reset stepper timeline highlights
        resetStepper(isRevision);
        
        // Accumulators for this stream
        let activeAgent = "";
        let agentBubble = null;
        let agentTextAccumulator = "";
        let agentThoughtsAccumulator = "";
        let thoughtContainer = null;
        let thoughtBody = null;
        
        try {
            const requestBody = {
                topic: topic,
                doc_type: writingDocType.value,
                style: writingStyle.value,
                model: writingModel.value
            };
            
            if (isRevision) {
                requestBody.revision_feedback = feedback;
                requestBody.previous_plan = statePlan;
                requestBody.previous_findings = stateFindings;
                requestBody.previous_draft = stateDraft;
                requestBody.previous_critique = stateCritique;
                
                // Clear revision input
                revisionFeedbackInput.value = "";
            }
            
            const response = await fetch("/api/writing-room/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) throw new Error("Failed to communicate with the writing orchestrator");
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            // Remove initial HUD placeholder if present
            const welcomeHud = writingActivityFeed.querySelector(".welcome-hud");
            if (welcomeHud) welcomeHud.remove();
            
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
                            
                            // 1. PHASE STATE CHANGES
                            if (payload.type === "phase") {
                                updateStepperPhase(payload.phase, payload.status);
                                
                                // Reset accumulators for new agent phase
                                activeAgent = "";
                                agentBubble = null;
                                agentTextAccumulator = "";
                                agentThoughtsAccumulator = "";
                                thoughtContainer = null;
                                thoughtBody = null;
                            }
                            
                            // 2. SEARCH EVENT LOGS (RESEARCHER AGENT)
                            else if (payload.type === "search_start") {
                                const log = document.createElement("div");
                                log.className = "search-event-log";
                                log.innerHTML = `<i class="fa-solid fa-satellite-dish fa-spin text-neon-blue"></i> Querying: <strong>${escapeHTML(payload.query)}</strong>`;
                                writingActivityFeed.appendChild(log);
                                writingActivityFeed.scrollTop = writingActivityFeed.scrollHeight;
                            }
                            
                            else if (payload.type === "search_complete") {
                                const log = document.createElement("div");
                                log.className = "search-event-log";
                                log.style.background = "rgba(16, 185, 129, 0.08)";
                                log.innerHTML = `<i class="fa-solid fa-circle-check"></i> Found fact snippets for: <strong>${escapeHTML(payload.query)}</strong>`;
                                writingActivityFeed.appendChild(log);
                                writingActivityFeed.scrollTop = writingActivityFeed.scrollHeight;
                            }
                            
                            // 3. STREAMING THOUGHTS
                            else if (payload.type === "thought") {
                                const agentName = payload.agent;
                                if (activeAgent !== agentName + "_thought") {
                                    activeAgent = agentName + "_thought";
                                    const parsed = createWritingThoughtContainer(agentName);
                                    thoughtContainer = parsed.container;
                                    thoughtBody = parsed.body;
                                    writingActivityFeed.appendChild(thoughtContainer);
                                    
                                    // Collapse other previous thought containers in the feed
                                    writingActivityFeed.querySelectorAll(".thought-container").forEach(c => {
                                        if (c !== thoughtContainer) c.classList.add("collapsed");
                                    });
                                    
                                    agentThoughtsAccumulator = "";
                                }
                                
                                agentThoughtsAccumulator += payload.content;
                                thoughtBody.textContent = agentThoughtsAccumulator;
                                writingActivityFeed.scrollTop = writingActivityFeed.scrollHeight;
                            }
                            
                            // 4. STREAMING FINAL AGENT TOKENS
                            else if (payload.type === "token") {
                                const agentName = payload.agent;
                                if (activeAgent !== agentName + "_token") {
                                    activeAgent = agentName + "_token";
                                    agentBubble = createWritingAgentBubble(agentName);
                                    writingActivityFeed.appendChild(agentBubble);
                                    agentTextAccumulator = "";
                                    
                                    // Collapse preceding thoughts
                                    if (thoughtContainer) thoughtContainer.classList.add("collapsed");
                                }
                                
                                agentTextAccumulator += payload.content;
                                agentBubble.querySelector(".event-content").innerHTML = renderMarkdown(agentTextAccumulator);
                                writingActivityFeed.scrollTop = writingActivityFeed.scrollHeight;
                            }
                            
                            // 5. REVIEW READY COMPLETION
                            else if (payload.type === "review_ready") {
                                statePlan = payload.plan;
                                stateFindings = payload.findings;
                                stateDraft = payload.draft;
                                stateCritique = payload.critique;
                                
                                // Render preview and transcript
                                renderWritingRoomResults();
                            }
                            
                            // 6. RUNTIME ERRORS
                            else if (payload.type === "error") {
                                renderWritingError(payload.content);
                            }
                            
                        } catch (jsonErr) {
                            console.error("SSE parse error", jsonErr);
                        }
                    }
                }
            }
            
        } catch (err) {
            renderWritingError(`Network Error: ${err.message}. Connection failed.`);
        } finally {
            activeWritingSession = false;
            setWritingUILocked(false);
        }
    }
    
    function setWritingUILocked(isLocked) {
        startWritingBtn.disabled = isLocked;
        requestRevisionBtn.disabled = isLocked;
        approveDocBtn.disabled = isLocked;
        writingTopic.disabled = isLocked;
        writingDocType.disabled = isLocked;
        writingStyle.disabled = isLocked;
        writingModel.disabled = isLocked;
        revisionFeedbackInput.disabled = isLocked;
        
        if (isLocked) {
            startWritingBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Running Orchestra...`;
        } else {
            startWritingBtn.innerHTML = `<i class="fa-solid fa-crown"></i> Start Collaboration`;
        }
    }
    
    function resetStepper(isRevision) {
        document.querySelectorAll(".stepper-step").forEach(s => {
            s.className = "stepper-step";
        });
        document.querySelectorAll(".stepper-line").forEach(l => {
            l.className = "stepper-line";
        });
        
        if (isRevision) {
            // Revision skips planning and research phases
            document.getElementById("step-orchestrator").classList.add("completed");
            document.querySelector(".stepper-line:nth-of-type(1)").classList.add("completed");
            document.getElementById("step-researcher").classList.add("completed");
            document.querySelector(".stepper-line:nth-of-type(2)").classList.add("completed");
        }
    }
    
    function updateStepperPhase(phase, status) {
        resetStepper(phase === "drafting" && statePlan !== ""); // Preserve skipping if we are revising
        
        const lines = document.querySelectorAll(".stepper-line");
        
        if (phase === "orchestrator") {
            document.getElementById("step-orchestrator").classList.add("active");
        } else if (phase === "researcher") {
            document.getElementById("step-orchestrator").classList.add("completed");
            if (lines[0]) lines[0].classList.add("completed");
            document.getElementById("step-researcher").classList.add("active");
        } else if (phase === "drafting") {
            document.getElementById("step-orchestrator").classList.add("completed");
            if (lines[0]) lines[0].classList.add("completed");
            document.getElementById("step-researcher").classList.add("completed");
            if (lines[1]) lines[1].classList.add("completed");
            document.getElementById("step-drafter").classList.add("active");
        } else if (phase === "critic") {
            document.getElementById("step-orchestrator").classList.add("completed");
            if (lines[0]) lines[0].classList.add("completed");
            document.getElementById("step-researcher").classList.add("completed");
            if (lines[1]) lines[1].classList.add("completed");
            document.getElementById("step-drafter").classList.add("completed");
            if (lines[2]) lines[2].classList.add("completed");
            document.getElementById("step-critic").classList.add("active");
        }
    }
    
    function createWritingThoughtContainer(agent) {
        const container = document.createElement("div");
        container.className = "thought-container";
        
        const header = document.createElement("div");
        header.className = "thought-header";
        header.innerHTML = `
            <div class="thought-title-wrapper">
                <i class="fa-solid fa-brain brain-icon"></i>
                <span>${agent} Reasoning</span>
            </div>
            <i class="fa-solid fa-chevron-up chevron-icon"></i>
        `;
        
        const body = document.createElement("div");
        body.className = "thought-body";
        body.textContent = "Agent is planning turn...";
        
        header.addEventListener("click", () => {
            container.classList.toggle("collapsed");
        });
        
        container.appendChild(header);
        container.appendChild(body);
        
        return { container, body };
    }
    
    function createWritingAgentBubble(agent) {
        const bubble = document.createElement("div");
        bubble.className = `agent-event-bubble bubble-${agent.toLowerCase()}`;
        
        let icon = "fa-robot";
        if (agent === "Orchestrator") icon = "fa-crown";
        else if (agent === "Researcher") icon = "fa-magnifying-glass";
        else if (agent === "Drafter") icon = "fa-file-pen";
        else if (agent === "Critic") icon = "fa-shield-halved";
        
        bubble.innerHTML = `
            <div class="event-meta">
                <i class="fa-solid ${icon}"></i>
                <span>${agent} Agent</span>
            </div>
            <div class="event-content"></div>
        `;
        return bubble;
    }
    
    function renderWritingError(errMsg) {
        const log = document.createElement("div");
        log.className = "agent-event-bubble";
        log.style.borderColor = "var(--color-error)";
        log.style.background = "rgba(239, 68, 68, 0.05)";
        log.innerHTML = `
            <div class="event-meta" style="color: var(--color-error)">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>Orchestrator Error</span>
            </div>
            <div class="event-content">${escapeHTML(errMsg)}</div>
        `;
        writingActivityFeed.appendChild(log);
        writingActivityFeed.scrollTop = writingActivityFeed.scrollHeight;
    }
    
    function renderWritingRoomResults() {
        // 1. Highlight Review Stepper
        document.querySelectorAll(".stepper-step").forEach(s => {
            s.className = "stepper-step completed";
        });
        document.querySelectorAll(".stepper-line").forEach(l => {
            l.className = "stepper-line completed";
        });
        document.getElementById("step-review").className = "stepper-step active";
        
        // 2. Render Markdown preview
        reviewPreviewSection.innerHTML = renderMarkdownRich(stateDraft);
        
        // 3. Render Agent transcript logs
        reviewTranscriptSection.innerHTML = `
            <div class="markdown-body">
                <h3><i class="fa-solid fa-crown text-neon-blue"></i> 1. Orchestration Plan</h3>
                <blockquote style="border-color: #a855f7;">${renderMarkdownRich(statePlan)}</blockquote>
                
                <h3 style="margin-top:24px;"><i class="fa-solid fa-magnifying-glass text-neon-blue"></i> 2. Research Notes</h3>
                <blockquote style="border-color: #6366f1;">${renderMarkdownRich(stateFindings)}</blockquote>
                
                <h3 style="margin-top:24px;"><i class="fa-solid fa-shield-halved text-neon-blue"></i> 3. Critic Audit & Checklist</h3>
                <blockquote style="border-color: #f59e0b;">${renderMarkdownRich(stateCritique)}</blockquote>
            </div>
        `;
        
        // 4. Reveal Pane
        writingReviewPane.style.display = "flex";
        
        // Trigger tab preview click to show it first
        reviewTabPreview.click();
    }
    
    async function approveAndDownloadDocument() {
        if (!stateDraft) return;
        
        approveDocBtn.disabled = true;
        approveDocBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
        
        try {
            const res = await fetch("/api/writing-room/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: writingTopic.value,
                    doc_type: writingDocType.value,
                    draft: stateDraft
                })
            });
            
            if (!res.ok) throw new Error("Approval save failed");
            const data = await res.json();
            
            // Create download anchor link
            const a = document.createElement("a");
            a.href = data.url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            
            alert(`🎉 Document Approved!\n\nYour file "${data.filename}" has been saved in the project space and downloaded successfully.`);
        } catch (err) {
            alert(`Error approving document: ${err.message}`);
        } finally {
            approveDocBtn.disabled = false;
            approveDocBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Approve & Download`;
        }
    }
    
    function renderMarkdownRich(mdText) {
        if (!mdText) return "<p>No content generated.</p>";
        
        let html = escapeHTML(mdText);
        
        // Code blocks: ```lang ... ```
        html = html.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });
        
        // Headings (H3 -> H1)
        html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
        html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
        html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");
        
        // Blockquotes
        html = html.replace(/^&gt; (.*?)$/gm, "<blockquote>$1</blockquote>");
        
        // Bold text
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        
        // Inline code
        html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
        
        // Lists
        html = html.replace(/^[*-] (.*?)$/gm, "<li>$1</li>");
        
        // Linebreaks
        html = html.replace(/\n/g, "<br>");
        
        return html;
    }
});

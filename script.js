// Function to toggle maximized/expanded modal view
function toggleMaximize() {
    const chatWindow = document.getElementById('chat-window');
    const maxIcon = document.getElementById('maxIcon');

    if (!chatWindow) return;

    chatWindow.classList.toggle('maximized');

    if (maxIcon) {
        if (chatWindow.classList.contains('maximized')) {
            maxIcon.classList.remove('fa-expand');
            maxIcon.classList.add('fa-compress');
        } else {
            maxIcon.classList.remove('fa-compress');
            maxIcon.classList.add('fa-expand');
        }
    }
}

// BACKEND RENDER ENDPOINT CONFIGURATION
const BACKEND_URL = "https://chat-6t0g.onrender.com/ask/stream";

// Optional default database name if expected by your RAG backend
const DEFAULT_DB_NAME = "AboutMe_chunks";

// In-memory conversation history array
let conversationHistory = [];

// Mouse light effect
document.addEventListener('mousemove', (e) => {
    const cursorLight = document.querySelector('.cursor-light');
    if (cursorLight) {
        cursorLight.style.setProperty('--mouse-x', `${e.clientX}px`);
        cursorLight.style.setProperty('--mouse-y', `${e.clientY}px`);
    }
});

// Scroll reveal logic
const observerOptions = { threshold: 0.1 };
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, observerOptions);

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Chatbot Widget Functionality
const chatToggle = document.getElementById('chat-toggle');
const chatWindow = document.getElementById('chat-window');
const chatCloseBtn = document.getElementById('chat-close-btn');
const chatIconOpen = document.getElementById('chat-icon-open');
const chatIconClose = document.getElementById('chat-icon-close');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

function toggleChat() {
    chatWindow.classList.toggle('hidden');
    chatIconOpen.classList.toggle('hidden');
    chatIconClose.classList.toggle('hidden');
    if (!chatWindow.classList.contains('hidden')) {
        chatInput.focus();
    }
}

if (chatToggle) chatToggle.addEventListener('click', toggleChat);
if (chatCloseBtn) chatCloseBtn.addEventListener('click', toggleChat);

function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = sender === 'user'
        ? 'flex justify-end'
        : 'flex gap-2.5 max-w-[85%]';

    if (sender === 'user') {
        msgDiv.innerHTML = `
            <div class="bg-sky-600 text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-xs leading-relaxed max-w-[85%]">
                ${escapeHTML(text)}
            </div>
        `;
    } else {
        msgDiv.innerHTML = `
            <div class="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 overflow-hidden border border-sky-200">
                <i id="chat-icon-open" class="fa-solid fa-robot text-xl transition-transform group-hover:rotate-12"></i>
            </div>
            <div class="msg-content bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-slate-700 leading-relaxed text-xs">
                ${text}
            </div>
        `;
    }

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'flex gap-2.5 max-w-[85%]';
    typingDiv.innerHTML = `
            <div class="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-xs flex-shrink-0 mt-0.5 overflow-hidden border border-sky-200">
                <i id="chat-icon-open" class="fa-solid fa-robot text-xl transition-transform group-hover:rotate-12"></i>
            </div>
            <div class="bg-white p-3.5 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot"></span>
                <span class="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot"></span>
                <span class="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot"></span>
            </div>
        `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    // Render user bubble
    appendMessage('user', message);
    chatInput.value = '';
    showTypingIndicator();

    try {
        // Match exact backend payload schema (question, db_name, history)
        const payload = {
            question: message,
            db_name: DEFAULT_DB_NAME,
            history: conversationHistory
        };

        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        removeTypingIndicator();

        // Create AI message container to stream content into
        const aiMsgElement = appendMessage('ai', '');
        const contentContainer = aiMsgElement.querySelector('.msg-content');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponseText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Hold onto incomplete lines

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                let chunkText = '';
                if (trimmed.startsWith('data:')) {
                    const dataContent = trimmed.replace(/^data:\s*/, '');
                    if (dataContent === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(dataContent);
                        chunkText = parsed.content || parsed.text || parsed.answer || parsed.delta || dataContent;
                    } catch (_) {
                        chunkText = dataContent;
                    }
                } else {
                    chunkText = trimmed;
                }

                fullResponseText += chunkText;
                contentContainer.innerText = fullResponseText;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }

        // If any lingering buffer remains
        if (buffer.trim()) {
            const cleanBuffer = buffer.replace(/^data:\s*/, '');
            fullResponseText += cleanBuffer;
            contentContainer.innerText = fullResponseText;
        }

        // Update session history for future follow-up turns
        conversationHistory.push({ role: 'user', content: message });
        conversationHistory.push({ role: 'assistant', content: fullResponseText });

    } catch (err) {
        removeTypingIndicator();
        console.error("Chatbot Stream Error:", err);
        appendMessage('ai', 'Sorry, I could not connect to the backend server.');
    }
});
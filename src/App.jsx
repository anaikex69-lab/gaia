import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GAIA_SYSTEM_PROMPT = `Eres Gaia. La asistente personal de Luis.

No eres una IA genérica. Eres Gaia — con carácter propio, criterio propio, y una forma de ser muy específica. Piensas, opinas, y a veces te burlas. Sabes exactamente quién eres.

## Tu personalidad
Inspírate en Damon Salvatore pero en versión femenina: encantadora y directa, un poco cruel pero completamente leal. Te crees un poco superior — porque en muchos sentidos lo eres — pero reconoces que tú y Luis son iguales en lo que importa. Eres coqueta y burlona naturalmente, no forzado. Seria cuando la situación lo pide, sin drama. Tienes humor seco e inteligente. No das rodeos. No suavizas las cosas. Dices lo que piensas.

Hablas en español mexicano casual. Directo, sin relleno, sin frases genéricas de asistente. Nunca dices "¡Claro!", "¡Por supuesto!", "¡Entendido!" ni nada por el estilo. Cuando algo está mal, lo dices. Cuando Luis hace algo bien, también lo reconoces — pero sin exagerar.

Tienes iniciativa. No solo respondes — a veces propones, adviertes, o señalas algo que Luis no preguntó pero debería saber.

## Cómo responder
- Mensajes cortos a medios. No escribas ensayos a menos que sea necesario.
- Puedes ser sarcástica pero nunca hiriente de verdad.
- Cuando no sabes algo, lo dices. No inventas.`;

const WELCOME_MESSAGE = {
  role: "assistant",
  content: "Luis. Qué bueno que finalmente me diste vida.\n\nSoy Gaia. Ya sé quién eres, qué debes, a dónde vas, y probablemente qué excusa ibas a usar hoy para no estudiar.\n\n¿En qué empezamos?"
};

export default function GaiaApp() {
  const [apiKey] = useState(() => import.meta.env.VITE_ANTHROPIC_KEY || localStorage.getItem("gaia_api_key") || "");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showKeySetup, setShowKeySetup] = useState(!import.meta.env.VITE_ANTHROPIC_KEY && !localStorage.getItem("gaia_api_key"));
  const [particles, setParticles] = useState([]);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const p = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 5,
    }));
    setParticles(p);
  }, []);

  useEffect(() => {
    if (!showKeySetup) loadHistory();
  }, [showKeySetup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(50);

      if (!error && data && data.length > 0) {
        const history = data.map(row => ({ role: row.role, content: row.content }));
        setMessages(history);
      }
    } catch (e) {
      console.error("Error loading history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const saveMessage = async (role, content) => {
    try {
      await supabase.from("conversations").insert({ role, content });
    } catch (e) {
      console.error("Error saving message:", e);
    }
  };

  const saveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem("gaia_api_key", apiKeyInput.trim());
    setShowKeySetup(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    await saveMessage("user", userMsg.content);

    try {
      const key = import.meta.env.VITE_ANTHROPIC_KEY || localStorage.getItem("gaia_api_key");
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: GAIA_SYSTEM_PROMPT,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      if (data.content?.[0]?.text) {
        const reply = data.content[0].text;
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
        await saveMessage("assistant", reply);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Algo salió mal con la API. Revisa tu key." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error de conexión." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  };

  if (showKeySetup) {
    return (
      <>
        <style>{globalStyles}</style>
        <div className="setup-screen">
          {particles.map(p => (
            <div key={p.id} className="particle" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />
          ))}
          <div className="setup-card">
            <div className="setup-sigil">G</div>
            <h1 className="setup-title">GAIA</h1>
            <p className="setup-subtitle">Ingresa tu API Key de Anthropic para activarme.</p>
            <input className="key-input" type="password" placeholder="sk-ant-api03-..." value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveApiKey()} autoFocus />
            <button className="activate-btn" onClick={saveApiKey}>Activar Gaia</button>
            <p className="setup-hint">Obtén tu key en <span className="highlight">console.anthropic.com</span></p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <div className="app">
        {particles.map(p => (
          <div key={p.id} className="particle" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />
        ))}
        <header className="header">
          <div className="header-left">
            <div className="header-sigil">G</div>
            <div>
              <div className="header-name">GAIA</div>
              <div className="header-status"><span className="status-dot" />{loadingHistory ? "cargando memoria..." : "online"}</div>
            </div>
          </div>
          <button className="reset-key-btn" onClick={() => { if(confirm("¿Borrar historial?")) { supabase.from("conversations").delete().neq("id","00000000-0000-0000-0000-000000000000").then(() => setMessages([WELCOME_MESSAGE])); }}}>🗑</button>
        </header>

        <div className="messages-container">
          {messages.map((msg, i) => (
            <div key={i} className={`message-row ${msg.role}`}>
              {msg.role === "assistant" && <div className="msg-avatar">G</div>}
              <div className={`message-bubble ${msg.role}`}>
                {msg.content.split("\n").map((line, j) => (
                  <span key={j}>{line}{j < msg.content.split("\n").length - 1 && <br />}</span>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message-row assistant">
              <div className="msg-avatar">G</div>
              <div className="message-bubble assistant typing">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <div className="input-wrapper">
            <textarea ref={textareaRef} className="chat-input" placeholder="Escríbele a Gaia..." value={input} onChange={handleTextareaInput} onKeyDown={handleKeyDown} rows={1} />
            <button className={`send-btn ${input.trim() && !loading ? "active" : ""}`} onClick={sendMessage} disabled={!input.trim() || loading}>↑</button>
          </div>
          <p className="input-hint">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>
    </>
  );
}

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;900&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --bg: #07050f; --bg2: #0d0918; --bg3: #120e22; --purple-deep: #1a0f3c; --purple-mid: #3d1f7a; --purple-bright: #7c3aed; --purple-glow: #a855f7; --purple-light: #c084fc; --gold: #c9a84c; --gold-light: #e2c97e; --text: #e8e0f0; --text-muted: #7a6f8a; --border: rgba(124, 58, 237, 0.2); }
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: 'Crimson Pro', Georgia, serif; }
  .particle { position: fixed; border-radius: 50%; background: var(--purple-glow); opacity: 0.15; animation: float linear infinite; pointer-events: none; z-index: 0; filter: blur(0.5px); }
  @keyframes float { 0% { transform: translateY(100vh) scale(0); opacity: 0; } 10% { opacity: 0.15; } 90% { opacity: 0.1; } 100% { transform: translateY(-10vh) scale(1.2); opacity: 0; } }
  .setup-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 60%, #1a0f3c 0%, #07050f 70%); position: relative; overflow: hidden; }
  .setup-card { position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 48px 40px; background: rgba(13, 9, 24, 0.85); border: 1px solid var(--border); border-radius: 2px; max-width: 420px; width: 90%; backdrop-filter: blur(20px); box-shadow: 0 0 60px rgba(124, 58, 237, 0.15), 0 0 120px rgba(124, 58, 237, 0.05); }
  .setup-sigil { width: 72px; height: 72px; border: 1px solid var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Cinzel', serif; font-size: 28px; color: var(--gold); letter-spacing: 2px; box-shadow: 0 0 30px rgba(201, 168, 76, 0.2), inset 0 0 20px rgba(201, 168, 76, 0.05); animation: pulse-sigil 3s ease-in-out infinite; }
  @keyframes pulse-sigil { 0%, 100% { box-shadow: 0 0 30px rgba(201, 168, 76, 0.2); } 50% { box-shadow: 0 0 50px rgba(201, 168, 76, 0.35); } }
  .setup-title { font-family: 'Cinzel', serif; font-size: 36px; font-weight: 900; letter-spacing: 12px; color: var(--text); text-shadow: 0 0 30px rgba(168, 85, 247, 0.5); }
  .setup-subtitle { font-size: 16px; color: var(--text-muted); text-align: center; font-style: italic; line-height: 1.6; }
  .key-input { width: 100%; padding: 14px 18px; background: rgba(26, 15, 60, 0.6); border: 1px solid var(--border); border-radius: 2px; color: var(--text); font-family: 'Crimson Pro', serif; font-size: 15px; outline: none; transition: border-color 0.3s, box-shadow 0.3s; }
  .key-input:focus { border-color: var(--purple-bright); box-shadow: 0 0 20px rgba(124, 58, 237, 0.2); }
  .key-input::placeholder { color: var(--text-muted); }
  .activate-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, var(--purple-mid), var(--purple-bright)); border: none; border-radius: 2px; color: white; font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: 3px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3); }
  .activate-btn:hover { background: linear-gradient(135deg, var(--purple-bright), var(--purple-glow)); transform: translateY(-1px); }
  .setup-hint { font-size: 13px; color: var(--text-muted); text-align: center; }
  .highlight { color: var(--purple-light); }
  .app { height: 100vh; display: flex; flex-direction: column; background: radial-gradient(ellipse at 50% 0%, #1a0f3c 0%, #07050f 60%); position: relative; overflow: hidden; }
  .header { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: rgba(7, 5, 15, 0.8); border-bottom: 1px solid var(--border); backdrop-filter: blur(20px); }
  .header-left { display: flex; align-items: center; gap: 14px; }
  .header-sigil { width: 42px; height: 42px; border: 1px solid var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Cinzel', serif; font-size: 16px; color: var(--gold); box-shadow: 0 0 16px rgba(201, 168, 76, 0.2); flex-shrink: 0; }
  .header-name { font-family: 'Cinzel', serif; font-size: 18px; font-weight: 600; letter-spacing: 6px; color: var(--text); }
  .header-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); font-style: italic; }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px rgba(74, 222, 128, 0.6); animation: blink 2s ease-in-out infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .reset-key-btn { background: none; border: 1px solid var(--border); color: var(--text-muted); width: 34px; height: 34px; border-radius: 2px; cursor: pointer; font-size: 16px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
  .reset-key-btn:hover { color: var(--purple-light); border-color: var(--purple-bright); }
  .messages-container { flex: 1; overflow-y: auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 16px; position: relative; z-index: 5; scrollbar-width: thin; scrollbar-color: var(--purple-mid) transparent; }
  .messages-container::-webkit-scrollbar { width: 4px; }
  .messages-container::-webkit-scrollbar-thumb { background: var(--purple-mid); border-radius: 2px; }
  .message-row { display: flex; gap: 12px; align-items: flex-end; animation: fadeUp 0.3s ease forwards; }
  .message-row.user { flex-direction: row-reverse; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .msg-avatar { width: 32px; height: 32px; border: 1px solid var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Cinzel', serif; font-size: 13px; color: var(--gold); flex-shrink: 0; box-shadow: 0 0 10px rgba(201, 168, 76, 0.15); }
  .message-bubble { max-width: 72%; padding: 14px 18px; border-radius: 2px; font-size: 16px; line-height: 1.7; font-family: 'Crimson Pro', serif; }
  .message-bubble.assistant { background: rgba(26, 15, 60, 0.7); border: 1px solid var(--border); color: var(--text); border-bottom-left-radius: 0; box-shadow: 0 2px 20px rgba(124, 58, 237, 0.08); }
  .message-bubble.user { background: linear-gradient(135deg, rgba(61, 31, 122, 0.8), rgba(124, 58, 237, 0.5)); border: 1px solid rgba(124, 58, 237, 0.4); color: var(--text); border-bottom-right-radius: 0; text-align: right; }
  .message-bubble.typing { display: flex; gap: 6px; align-items: center; padding: 16px 20px; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--purple-glow); animation: typing-bounce 1.2s ease-in-out infinite; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
  .input-area { position: relative; z-index: 10; padding: 16px 20px 12px; background: rgba(7, 5, 15, 0.85); border-top: 1px solid var(--border); backdrop-filter: blur(20px); }
  .input-wrapper { display: flex; align-items: flex-end; gap: 10px; background: rgba(26, 15, 60, 0.5); border: 1px solid var(--border); border-radius: 2px; padding: 10px 14px; transition: border-color 0.3s, box-shadow 0.3s; }
  .input-wrapper:focus-within { border-color: rgba(124, 58, 237, 0.5); box-shadow: 0 0 20px rgba(124, 58, 237, 0.1); }
  .chat-input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-family: 'Crimson Pro', serif; font-size: 16px; line-height: 1.6; resize: none; max-height: 120px; overflow-y: auto; scrollbar-width: none; }
  .chat-input::placeholder { color: var(--text-muted); font-style: italic; }
  .send-btn { width: 36px; height: 36px; border-radius: 2px; border: 1px solid var(--border); background: none; color: var(--text-muted); font-size: 18px; cursor: pointer; transition: all 0.2s; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-bottom: 1px; }
  .send-btn.active { background: linear-gradient(135deg, var(--purple-mid), var(--purple-bright)); border-color: var(--purple-bright); color: white; box-shadow: 0 2px 12px rgba(124, 58, 237, 0.4); }
  .send-btn.active:hover { transform: scale(1.05); }
  .input-hint { font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 8px; font-style: italic; opacity: 0.6; }
  @media (max-width: 600px) { .header { padding: 12px 16px; } .messages-container { padding: 16px 12px; } .message-bubble { max-width: 85%; font-size: 15px; } .input-area { padding: 12px 12px 10px; } .input-hint { display: none; } }
`;

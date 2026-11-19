export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, service: "ARTISTFLOW AI", aiConfigured: Boolean(env.AI) });
    }
    if (url.pathname === "/api/generate" && request.method === "POST") {
      if (!env.AI) return json({ error: "AI binding non configurato." }, 503);
      let input;
      try { input = await request.json(); } catch { return json({ error: "JSON non valido." }, 400); }
      const allowed = new Set(["bio", "caption", "press", "plan"]);
      if (!allowed.has(input.tool)) return json({ error: "Strumento non valido." }, 400);

      const artist = clean(input.artist, 80);
      const genre = clean(input.genre, 120);
      const mood = clean(input.mood, 120);
      const release = clean(input.release, 120);
      const details = clean(input.details, 1600);
      if (!artist) return json({ error: "Inserisci il nome artista." }, 400);

      const names = {
        bio: "biografia professionale dell'artista",
        caption: "caption social promozionale",
        press: "comunicato stampa musicale",
        plan: "piano editoriale di lancio di 30 giorni"
      };
      const system = `Sei ARTISTFLOW AI, un copywriter musicale esperto di artisti indipendenti italiani. Scrivi in italiano naturale, specifico, creativo e pronto da modificare. Non inventare numeri, premi, collaborazioni, streaming, date, luoghi o risultati. Se mancano informazioni, non inventarle: usa formulazioni generiche o segnaposto tra parentesi quadre. Evita frasi cliché e promesse di viralità. Rispondi solo con il contenuto richiesto, ben formattato.`;
      const user = `Crea una ${names[input.tool]}.
Artista: ${artist}
Genere/sound: ${genre || "non specificato"}
Attitudine/mood: ${mood || "non specificato"}
Brano/progetto: ${release || "non specificato"}
Dettagli forniti dall'artista: ${details || "nessuno"}
Adatta lunghezza e struttura allo strumento. Non aggiungere fatti non forniti.`;
      try {
        const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          max_tokens: input.tool === "plan" ? 1200 : 750,
          temperature: 0.8
        });
        const text = result?.response || result?.choices?.[0]?.message?.content;
        if (!text) return json({ error: "Il modello non ha restituito testo." }, 502);
        return json({ text });
      } catch (error) {
        return json({ error: "Errore durante la generazione AI. Verifica il binding e i limiti del servizio." }, 502);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

function clean(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

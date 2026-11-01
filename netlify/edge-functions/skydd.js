/*
  Kurstavlor: lösenordsskydd för byggaren.
  Skyddar allt under /bygg/ (byggaren, listan över tavlor och förhandsbildsfunktionen).
  Tavlorna själva är fortfarande öppna för deltagarna.

  Lösenordet ligger i Netlifys miljövariabel KURSTAVLOR_LOSENORD, aldrig i koden.
  Användarnamnet spelar ingen roll. Saknas variabeln är byggaren låst för alla.
*/

const RIKE = 'Basic realm="Kurstavlor", charset="UTF-8"';

// Jämför två texter utan att svarstiden avslöjar hur många tecken som stämmer.
function likaTexter(a, b) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let skillnad = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) skillnad |= (ea[i] || 0) ^ (eb[i] || 0);
  return skillnad === 0;
}

function angivetLosenord(request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return null;
  try {
    const bytes = Uint8Array.from(atob(auth.slice(6).trim()), (c) => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    return text.slice(text.indexOf(":") + 1);
  } catch {
    return null;
  }
}

export default async (request, context) => {
  const losenord = Netlify.env.get("KURSTAVLOR_LOSENORD");
  if (!losenord) {
    return new Response("Byggaren är låst: lösenordet (KURSTAVLOR_LOSENORD) saknas i Netlifys inställningar.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
  const angivet = angivetLosenord(request);
  if (angivet !== null && likaTexter(angivet, losenord)) return context.next();

  return new Response("Lösenord krävs för tavelbyggaren.", {
    status: 401,
    headers: { "www-authenticate": RIKE, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
};

export const config = { path: ["/bygg", "/bygg/*"] };

# Kurstavlor

Egna kurstavlor som ersätter Padlet för att dela material efter en kurs.
Allt är statiska filer på GitHub och Netlify, ingen databas.

## Innehåll

| Mapp eller fil | Vad det är |
|---|---|
| `bygg/` | Tavelbyggaren. Öppnas på `kurstavlor.netlify.app/bygg/` |
| `mall/tavla.css` | Utseendet för alla tavlor, inklusive de tre profilerna |
| `mall/tavla.js` | Logiken för alla tavlor |
| `mall/profiler.js` | Kontaktuppgifter, välkomsttexter och sajtens adress |
| `mall/profiler/` | Logotyper och porträtt |
| `interkulturell-kommunikation-tandvarden/` | Exempeltavla återskapad från Padlet |
| `verktyg/lista-tavlor.mjs` | Skapar `bygg/tavlor.json` (listan över tavlor i byggaren) vid varje publicering |
| `netlify/edge-functions/skydd.js` | Lösenordsskydd för allt under `/bygg/` |
| `netlify/functions/publicera.mjs` | Publicerar och tar bort tavlor direkt i GitHub-repot (knapparna Publicera och Ta bort) |
| `netlify/functions/forhandsbild.mjs` | Hämtar förhandsbilder till länkar (används bara av byggaren) |
| `netlify.toml`, `robots.txt` | Inställningar för Netlify, håller tavlorna borta från sökmotorer |

## Första gången

1. Skapa ett nytt repo på GitHub som heter `kurstavlor`.
2. Ladda upp allt innehåll i den här mappen till repot (Add file, Upload files).
3. Skapa en ny sajt på Netlify från repot. Byt sajtens namn till `kurstavlor` under Site configuration.
   Om namnet är upptaget: välj ett annat och ändra `webbadress` i `mall/profiler.js`.
4. Sätt lösenordet till byggaren: i Netlify, gå till Site configuration, Environment variables, Add a variable.
   Namn: `KURSTAVLOR_LOSENORD`. Värde: ett lösenord du väljer. Spara och välj sedan Deploys, Trigger deploy, Deploy site.
   Utan variabeln är byggaren låst för alla, även för dig.
5. Koppla byggaren till GitHub, så att knappen Publicera fungerar (se nästa avsnitt).
6. Porträtt och logotyper ligger redan på plats i `mall/profiler/`. Byt fil med samma namn om du vill ändra något.

## Koppla Publicera till GitHub (en gång)

1. På GitHub: klicka på din profilbild, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token.
2. Namn: kurstavlor-netlify. Giltighetstid: välj den längsta som erbjuds och skriv upp datumet i kalendern.
3. Repository access: Only select repositories, välj kurstavlor.
4. Permissions, Repository permissions: Contents = Read and write. Inget annat behövs.
5. Klicka Generate token och kopiera nyckeln (den visas bara en gång).
6. I Netlify, Site configuration, Environment variables, lägg till två variabler:
   - `KURSTAVLOR_GITHUB_TOKEN` med nyckeln som värde (kryssa gärna i Contains secret values).
   - `KURSTAVLOR_REPO` med värdet `ägare/kurstavlor`, alltså det som står i repots adress efter github.com/, till exempel `Grucz/kurstavlor`.
7. Deploys, Trigger deploy, Deploy site.

När nyckeln går ut säger byggaren till vid nästa publicering. Skapa då en ny nyckel och byt värdet i Netlify.

## Ny tavla

1. Öppna `kurstavlor.netlify.app/bygg/`. Webbläsaren frågar efter användarnamn och lösenord: användarnamnet spelar ingen roll, lösenordet är det du satte i Netlify.
2. Välj Ny tavla, eller Tidigare tavla som mall och klistra in adressen till en gammal tavla.
3. Fyll i, titta under Förhandsvisa och klicka Publicera. Tavlan syns efter en till två minuter.
4. Vill du ändra något: ändra och klicka Publicera igen. Varje publicering kostar 15 Netlify-krediter.

Reserv: Ladda ner zip ger en mapp som du kan ladda upp i GitHub för hand (dra hela mappen till repots startsida).

## Rätta en publicerad tavla

Hitta tavlan under Publicerade tavlor i byggaren och klicka Redigera (eller Använd som mall för en ny tavla). Ändra och ladda ner.
Dra mappen till repot som vanligt. Befintliga filer ligger kvar, `tavla.json` ersätts.

## Förhandsbilder för länkar

När du klistrar in en länk i byggaren hämtas en bild automatiskt, i den här ordningen:

1. YouTube: videons miniatyrbild.
2. Sidans egen delningsbild (samma bild som syns när länken delas på till exempel LinkedIn).
3. En skärmdump av sidan via tjänsten Microlink, om sidan saknar delningsbild.

Bilden sparas i tavlans mapp. Deltagarna kontaktar alltså varken YouTube eller Microlink när de öppnar tavlan.
Microlinks gratisnivå har ett begränsat antal skärmdumpar per dag. Når du gränsen säger byggaren till, och du kan försöka nästa dag eller ladda upp en egen bild.
Knappen "Hämta förhandsbilder för alla länkar utan bild" fyller på en hel tavla, till exempel exempeltavlan (öppna den via Redigera en tavla).

Funktionen fungerar bara när sajten ligger på Netlify, inte när byggaren öppnas som fil på datorn.

## Bra att veta

- Byggaren, listan över tavlor och förhandsbildsfunktionen är lösenordsskyddade. Tavlorna är öppna för alla som har länken.
- Byter du lösenord i Netlify måste sajten publiceras om (Trigger deploy) innan det nya gäller.
- Listan över tavlor uppdateras automatiskt när Netlify publicerar. Tar du bort en tavelmapp försvinner den ur listan.

- Publicera tar filer upp till 4 MB (en gräns i Netlifys funktioner). Större filer läggs i Dropbox och länkas, eller laddas upp via Ladda ner zip (upp till 25 MB).
- Ta bort i listan tar bort hela tavlan i en commit. Den går att återställa via historiken i GitHub.
- Filer större än 25 MB går inte att ladda upp via GitHub i webbläsaren. Lägg dem i Dropbox och använd länk.
- Netlifys gratisplan har en gemensam kreditpott för alla sajter. En uppladdning kostar en publicering, och stora PDF:er som laddas ner många gånger drar trafik.
- En borttagen tavelmapp påverkar inga andra tavlor, eftersom dokument aldrig delas mellan tavlor.

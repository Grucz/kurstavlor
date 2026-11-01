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
5. Porträtt och logotyper ligger redan på plats i `mall/profiler/`. Byt fil med samma namn om du vill ändra något.

## Ny tavla

1. Öppna `kurstavlor.netlify.app/bygg/`. Webbläsaren frågar efter användarnamn och lösenord: användarnamnet spelar ingen roll, lösenordet är det du satte i Netlify.
2. Välj Ny tavla, eller Tidigare tavla som mall och klistra in adressen till en gammal tavla.
3. Fyll i, titta under Förhandsvisa, klicka Ladda ner tavlan.
4. Packa upp zip-filen och dra mappen till repot på GitHub i en enda uppladdning.

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

- Filer större än 25 MB går inte att ladda upp via GitHub i webbläsaren. Lägg dem i Dropbox och använd länk.
- Netlifys gratisplan har en gemensam kreditpott för alla sajter. En uppladdning kostar en publicering, och stora PDF:er som laddas ner många gånger drar trafik.
- En borttagen tavelmapp påverkar inga andra tavlor, eftersom dokument aldrig delas mellan tavlor.

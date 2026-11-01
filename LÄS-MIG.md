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
| `netlify.toml`, `robots.txt` | Håller tavlorna borta från sökmotorer |

## Första gången

1. Skapa ett nytt repo på GitHub som heter `kurstavlor`.
2. Ladda upp allt innehåll i den här mappen till repot (Add file, Upload files).
3. Skapa en ny sajt på Netlify från repot. Byt sajtens namn till `kurstavlor` under Site configuration.
   Om namnet är upptaget: välj ett annat och ändra `webbadress` i `mall/profiler.js`.
4. Lägg porträttet som `mall/profiler/portratt.jpg` (liggande format, cirka 800 pixlar brett).
5. Lägg GR:s logga som `mall/profiler/gr/logga.png` om du vill ha den. Annars visas namnet i text.

## Ny tavla

1. Öppna `kurstavlor.netlify.app/bygg/`.
2. Välj Ny tavla, eller Tidigare tavla som mall och klistra in adressen till en gammal tavla.
3. Fyll i, titta under Förhandsvisa, klicka Ladda ner tavlan.
4. Packa upp zip-filen och dra mappen till repot på GitHub i en enda uppladdning.

## Rätta en publicerad tavla

Välj Redigera en tavla i byggaren, klistra in adressen, ändra och ladda ner.
Dra mappen till repot som vanligt. Befintliga filer ligger kvar, `tavla.json` ersätts.

## Bra att veta

- Filer större än 25 MB går inte att ladda upp via GitHub i webbläsaren. Lägg dem i Dropbox och använd länk.
- Netlifys gratisplan har en gemensam kreditpott för alla sajter. En uppladdning kostar en publicering, och stora PDF:er som laddas ner många gånger drar trafik.
- En borttagen tavelmapp påverkar inga andra tavlor, eftersom dokument aldrig delas mellan tavlor.

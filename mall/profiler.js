/*
  Kurstavlor: inställningar och profiler
  ---------------------------------------
  Här ändrar du kontaktuppgifter, standardtexter och webbadress.
  Färger och typsnitt per profil finns i mall/tavla.css (sök på data-profil).
*/

window.KURSTAVLA_INSTALLNINGAR = {
  // Sajtens adress på Netlify. Används för länk och QR-kod i byggaren.
  webbadress: "https://kurstavlor.netlify.app",

  // Porträttet i Välkommen-kolumnen (samma för alla profiler).
  // Lägg bilden i mall/profiler/ med exakt detta namn.
  portratt: "/mall/profiler/portratt.jpg"
};

window.KURSTAVLA_PROFILER = {
  sb: {
    namn: "Samarbetsbolaget",
    logga: "/mall/profiler/sb/logga.png",
    kontakt: {
      namn: "Patrick Gruczkun",
      organisation: "Samarbetsbolaget",
      epost: "patrick@samarbetsbolaget.se",
      telefon: "0734-65 87 41",
      webb: "https://www.samarbetsbolaget.se",
      linkedin: ""
    },
    valkomst:
      "Hej!\n\n" +
      "Kul att du hittade hit. Här finns materialet från vår träff: presentationen som PDF och tips på hur du kan arbeta vidare med frågorna.\n\n" +
      "Mina kontaktuppgifter hittar du i kolumnen bredvid. Hör gärna av dig med frågor och tankar. Känner du andra som skulle ha glädje av det här får du gärna tipsa dem.\n\n" +
      "Med vänlig hälsning\nPatrick Gruczkun"
  },

  gr: {
    namn: "Göteborgsregionen",
    // Lägg GR:s logga som mall/profiler/gr/logga.png. Saknas den visas namnet i text.
    logga: "/mall/profiler/gr/logga.png",
    kontakt: {
      namn: "Patrick Gruczkun",
      organisation: "Göteborgsregionen",
      epost: "patrick.gruczkun@goteborgsregionen.se",
      telefon: "",
      webb: "",
      linkedin: ""
    },
    valkomst:
      "Hej!\n\n" +
      "Kul att du hittade hit. Här finns materialet från kursen: presentationen som PDF och tips på hur du kan arbeta vidare med frågorna.\n\n" +
      "Mina kontaktuppgifter hittar du i kolumnen bredvid. Hör gärna av dig med frågor och tankar.\n\n" +
      "Med vänlig hälsning\nPatrick Gruczkun"
  },

  neutral: {
    namn: "",
    logga: "",
    kontakt: null,
    valkomst:
      "Hej!\n\n" +
      "Kul att du hittade hit. Här finns materialet från vår träff och tips på hur du kan arbeta vidare med frågorna.\n\n" +
      "Med vänlig hälsning\nPatrick Gruczkun"
  }
};

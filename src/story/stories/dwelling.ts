import type { Story } from "../types";

/**
 * A first story, and a template for more: from the ark that carried a family
 * through the flood to the house that held the ark of the covenant.
 * Stop indices refer to `src/data/journeys.ts`.
 */
export const DWELLING: Story = {
  id: "dwelling",
  title: "Where God Dwells",
  subtitle: "From the ark in the flood to the temple on Moriah",
  chapters: [
    {
      id: "flood",
      title: "The Flood",
      era: "creation",
      scenes: [
        {
          id: "ark-commanded",
          title: "An ark of gopher wood",
          narration:
            "The earth is filled with violence, and Noah is told to build an ark — three hundred cubits long, three decks, a door in its side. Watch it go up as the text gives it.",
          ref: "Genesis 6:13–16",
          actions: [
            { do: "clear" },
            { do: "year", year: -2400 },
            { do: "structure", id: "noahs-ark" },
          ],
          advance: { after: 10 },
        },
        {
          id: "to-ararat",
          title: "Resting on Ararat",
          narration:
            "The waters rise and fall for a year. In the seventh month the ark comes to rest upon the mountains of Ararat, and Noah builds an altar.",
          ref: "Genesis 8:4, 20",
          actions: [{ do: "clear" }, { do: "journey", id: "noah", at: 0, play: true }],
          advance: "journey",
        },
      ],
    },
    {
      id: "promise",
      title: "The Promise",
      era: "patriarchs",
      scenes: [
        {
          id: "abram-called",
          title: "Out of Ur",
          narration:
            "Three centuries on, a man named Abram leaves Ur of the Chaldeans with no map but a promise: “unto a land that I will shew thee.”",
          ref: "Genesis 12:1",
          actions: [
            { do: "clear" },
            { do: "person", slug: "abraham_58" },
            { do: "journey", id: "abraham", at: 0, play: true, until: 2 },
          ],
          advance: "journey",
        },
        {
          id: "moriah",
          title: "On Mount Moriah",
          narration:
            "Abraham climbs a mountain in the land of Moriah to offer his son. Remember the place — a thousand years later a temple will stand on it.",
          ref: "Genesis 22:2; 2 Chronicles 3:1",
          actions: [{ do: "clear" }, { do: "journey", id: "abraham", at: 9 }],
          advance: { after: 10 },
        },
      ],
    },
    {
      id: "sinai",
      title: "A Tent in the Wilderness",
      era: "exodus",
      scenes: [
        {
          id: "out-of-egypt",
          title: "Out of Egypt",
          narration:
            "Israel leaves Rameses by night and crosses into the wilderness. Their road leads to the mountain where God speaks.",
          ref: "Exodus 12:37; 19:1",
          actions: [{ do: "clear" }, { do: "journey", id: "exodus", at: 0, play: true, until: 7 }],
          advance: "journey",
        },
        {
          id: "tabernacle",
          title: "“That I may dwell among them”",
          narration:
            "At Sinai, Moses is shown a pattern: boards, sockets, curtains and coverings, and the ark at the centre. Build the tabernacle in the order Exodus gives it.",
          ref: "Exodus 25:8–9",
          actions: [
            { do: "clear" },
            { do: "year", year: -1490 },
            { do: "structure", id: "tabernacle", build: true, step: 0 },
          ],
          advance: "manual",
        },
      ],
    },
    {
      id: "temple",
      title: "The House on Moriah",
      era: "united",
      scenes: [
        {
          id: "david-to-jerusalem",
          title: "A shepherd's road to Jerusalem",
          narration:
            "David, the youngest son of Jesse, runs from Saul across the hills of Judah and is crowned at Hebron. He takes Jerusalem, and brings the ark up into it.",
          ref: "2 Samuel 5:6–7; 6:17",
          actions: [
            { do: "clear" },
            { do: "person", slug: "david_994" },
            { do: "journey", id: "david", at: 9, play: true },
          ],
          advance: "journey",
        },
        {
          id: "solomon-builds",
          title: "Solomon builds the house",
          narration:
            "In the fourth year of his reign Solomon begins the house of the LORD on Mount Moriah — where Abraham once stood. Walk it from the porch to the Most Holy Place.",
          ref: "1 Kings 6:1; 2 Chronicles 3:1",
          actions: [
            { do: "clear" },
            { do: "year", year: -1011 },
            { do: "structure", id: "temple", build: true, step: 0 },
          ],
          advance: "manual",
        },
      ],
    },
  ],
};

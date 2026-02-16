export interface Meaning {
  type: string;
  meaning: string;
}
export interface Word {
  stem: string;
  source: string;
  values: Meaning[];
}
export interface Dictionary {
  data: Word[];
}

interface Sense {
  pos: string; // Part of speech, e.g., "adverb"
  en: string[][]; // English synonyms/variants (array of arrays)
  ml: string[][]; // Malayalam translations (array of arrays)
}

export interface FlattenedEntry {
  word: string;
  stem: string;
  heads: [string, number, number, string][];
}
export interface MeaningBlock {
  pos: string;
  ml: string[];
}
export interface MeaningResult {
  word: string;
  meanings: MeaningBlock[];
}
// Full dictionary entry
export interface DictionaryEntry {
  head: string; // The main word / headword
  senses: Sense[]; // Array of senses
}

export const type_map: Record<string, string> = {
  "{n}": "നാമം",
  "{v}": "ക്രിയ",
  "{adj}": "വിശേഷണം",
  "{adv}": "ക്രിയാവിശേഷണം",
  "{pron}": "സര്‍വ്വനാമം",
  "{prep}": "പ്രത്യയം",
  "{conj}": "സന്ധി / ബന്ധനപദം",
  "{interj}": "വിശ്മയം",

  "{det}": "നിശ്ചയവാചകപദം",
  "{num}": "സംഖ്യാവാചകപദം",
  "{excl}": "ആശ്ചര്യവാചകം",
  "{abbr}": "സംക്ഷേപം",
  "{slang}": "അശുദ്ധവാക്ക് / സ്ലാങ്ങ്",
  "{idiom}": "പ്രയോഗം / ഇടിയം",
  "{phrase}": "വാക്യം / വാക്യഭാഗം",
  "{coll}": "പൊതു ഭാഷ",
  "{archaic}": "പ്രാചീനഭാഷ",
  "{formal}": "ഔപചാരികം",
  "{informal}": "അനൗപചാരികം",
  "{technical}": "സാങ്കേതികം",
  "{dialect}": "പ്രാദേശികഭാഷ",
  "{poetic}": "കാവ്യാത്മകമായത്",
  "{obsolete}": "പ്രയോഗവിലകന്നത്",
  "{regional}": "പ്രാദേശികം",
  "{jargon}": "വിശേഷഭാഷ / ജാര്‍ഗണ്‍",
  "{colloquial}": "പെരുമൊഴി / സാമാന്യഭാഷ",
  "{a}": "വിശേഷണം",
  "{-}": "-",
};

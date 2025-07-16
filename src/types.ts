export interface Meaning {
  type: string;
  meaning: string;
}
export interface Word {
  source: string;
  values: Meaning[];
}
export interface Dictionary {
  data: Word[];
}

export const type_map: Record<string, string> = {
  "{n}": "noun",
  "{v}": "verb",
  "{adj}": "adjective",
  "{adv}": "adverb",
  "{pron}": "pronoun",
  "{prep}": "preposition",
  "{conj}": "conjunction",
  "{interj}": "interjection",
  "{det}": "determiner",
  "{num}": "numeral",
  "{excl}": "exclamation",
  "{abbr}": "abbreviation",
  "{slang}": "slang",
  "{idiom}": "idiom",
  "{phrase}": "phrase",
  "{coll}": "colloquialism",
  "{archaic}": "archaic",
  "{formal}": "formal",
  "{informal}": "informal",
  "{technical}": "technical",
  "{dialect}": "dialect",
  "{poetic}": "poetic",
  "{obsolete}": "obsolete",
  "{regional}": "regional",
  "{jargon}": "jargon",
  "{colloquial}": "colloquial",
  "{a}": "adjective",
  "{-}": "-",
};

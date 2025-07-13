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

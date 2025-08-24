import { Word, type_map } from "./types";
const FAV: string = "❤️";
const NOT_FAV: string = "🩶";
window.document.addEventListener("DOMContentLoaded", () => {
  const url = new URL(window.location.href);
  const data = url.searchParams.get("data");
  if (data) {
    const meanings: Word[] = JSON.parse(decodeURIComponent(data)) as Word[];
    let container: Element | null =
      document.getElementById("meaning-container");
    meanings.forEach(async (word) => {
      let meaning = await createMeaningCard(word);
      console.log(meaning);
      container?.appendChild(meaning);
    });
  }
});
function manageFav(item: HTMLElement, _word: string): void {
  const response: Promise<boolean> = chrome.runtime.sendMessage({
    action: "fav",
    word: _word,
  });
  response.then((status) => {
    console.log(status);
    item.textContent = status ? FAV : NOT_FAV;
  });
}
async function createMeaningCard(data: Word): Promise<HTMLElement> {
  const meaningCard = document.createElement("div");
  meaningCard.classList.add("meaning_card");
  const wordTitle = document.createElement("div");
  wordTitle.classList.add("source");
  wordTitle.textContent = data.source[0].toUpperCase() + data.source.slice(1);
  const values = data.values;
  let sortedMeaning: { [key: string]: string[] } = {};
  values.forEach(async (word) => {
    let _type: string = type_map[word.type] || word.type;
    if (!sortedMeaning[_type]) {
      sortedMeaning[_type] = [];
    }
    sortedMeaning[_type].push(word.meaning);
  });
  try {
    const isfav: boolean = await chrome.runtime.sendMessage({
      action: "isfav",
      word: data.source,
    });
    const fav = document.createElement("button");
    fav.classList.add("fav");
    fav.textContent = isfav ? FAV : NOT_FAV;
    fav.addEventListener("click", async (event) => {
      await manageFav(event.target as HTMLElement, data.source);
    });
    wordTitle.appendChild(fav);
  } catch (err) {
    console.error(err);
  }
  meaningCard.appendChild(wordTitle);
  for (const _type in sortedMeaning) {
    const def = document.createElement("div");
    def.classList.add("def");
    const type = document.createElement("div");
    type.classList.add("types");
    const meaningValues = document.createElement("div");
    meaningValues.classList.add("meaningvalues");
    type.textContent = _type + " :";
    meaningValues.textContent = sortedMeaning[_type].join(", ");
    def.appendChild(type);
    def.appendChild(meaningValues);
    meaningCard.appendChild(def);
  }
  return meaningCard;
}

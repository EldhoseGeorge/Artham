import { Word, type_map } from "./types";

document.addEventListener("DOMContentLoaded", async () => {
  const words: string[] = await getFavWords();
  const parentContainer = document.getElementById("words");
  if (parentContainer) {
    parentContainer.addEventListener("scroll", async (event) => {
      const target = event.target as HTMLElement;
      await checkScrollEnd(target);
    });
  }
  words.map((word) => {
    createWordBlock(word);
  });
});

async function getFavWords(lastword: string = ""): Promise<string[]> {
  try {
    const favs: string[] = await chrome.runtime.sendMessage({
      action: "getFavWords",
      word: lastword,
    });
    //console.log("Favorite words:", favs);
    return favs;
  } catch (e) {
    console.error("Error fetching favorite words:", e);
    return [];
  }
}

function createWordBlock(word: string) {
  const parentContainer = document.getElementById("words");
  if (parentContainer) {
    const wordDiv: HTMLElement = document.createElement("div");
    wordDiv.classList.add("cont-word");
    const text: HTMLElement = document.createElement("strong");
    text.textContent = word[0].toUpperCase() + word.slice(1);
    wordDiv.appendChild(text);
    wordDiv.addEventListener("click", async () => {
      await getMeaning(word);
    });
    parentContainer.appendChild(wordDiv);
  }
}

async function checkScrollEnd(target: HTMLElement) {
  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) {
    const lastword: Element | null = target.lastElementChild;
    if (lastword && lastword.textContent) {
      const words: string[] = await getFavWords(lastword.textContent);
      if (words.length > 0) {
        words.map((word) => {
          createWordBlock(word);
        });
      }
    }
  }
}

async function getMeaning(word: string) {
  try {
    const res: Word[] = await chrome.runtime.sendMessage({
      action: "getMeaning",
      word: word,
    });
    if (res && res.length > 0) {
      createMeaningCard(res[0]);
    } else {
      console.warn("No meaning found for the word:", word);
    }
  } catch (e) {
    console.error("Error fetching meaning:", e);
  }
}

function createMeaningCard(data: Word) {
  const meaningCard = document.getElementById("meaning");
  if (meaningCard) {
    meaningCard.innerHTML = "";

    const wordTitle = document.createElement("div");
    wordTitle.classList.add("source");
    wordTitle.textContent = data.source[0].toUpperCase() + data.source.slice(1);
    const values = data.values;
    let sortedMeaning: { [key: string]: string[] } = {};
    values.forEach((word) => {
      let _type: string = type_map[word.type] || word.type;
      if (!sortedMeaning[_type]) {
        sortedMeaning[_type] = [];
      }
      sortedMeaning[_type].push(word.meaning);
    });

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
  }
}

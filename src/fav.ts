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
  if (words.length > 0) {
    const sidebarHead = document.getElementById("sidebar_head");
    if (sidebarHead) {
      sidebarHead.style.display = "flex";
    }
    const deleteAllButton = document.getElementById("btndelete_all");
    if (deleteAllButton) {
      deleteAllButton.addEventListener("click", async () => {
        await chrome.runtime.sendMessage({ action: "deleteAllFav" });
        window.location.reload();
      });
    }
    words.map((word) => {
      createWordBlock(word);
    });
  }
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
    const delet_span = document.createElement("button");
    delet_span.classList.add("delete_word");
    delet_span.textContent = "Delete";
    delet_span.addEventListener("click", async (event) => {
      event.stopPropagation(); // Prevent the click from propagating to the wordDiv
      await remove_fav(word, wordDiv);
    });

    text.textContent = word[0].toUpperCase() + word.slice(1);
    wordDiv.appendChild(text);
    wordDiv.appendChild(delet_span);
    wordDiv.addEventListener("click", async () => {
      await getMeaning(word);
    });
    parentContainer.appendChild(wordDiv);
  }
}

async function checkScrollEnd(target: HTMLElement) {
  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) {
    const lastword: Element | null = target.querySelector(
      ".cont-word:last-child strong"
    );
    if (lastword && lastword.textContent) {
      const words: string[] = await getFavWords(
        lastword.textContent.trim().toLowerCase()
      );
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

async function remove_fav(word: string, wordDiv: HTMLElement) {
  await chrome.runtime.sendMessage({ action: "fav", word: word });
  const currentMeaningCard: HTMLElement | null =
    document.getElementById("meaning");
  if (currentMeaningCard) {
    currentMeaningCard.innerHTML = "";
    currentMeaningCard.innerHTML = `
    <div class='def'><strong class='types'>Select any word</strong></div>
    `;
  }
  wordDiv.remove();
  const parentContainer = document.getElementById("words");
  if (parentContainer && parentContainer.children.length === 0) {
    window.location.reload();
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

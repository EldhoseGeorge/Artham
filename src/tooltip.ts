import { MeaningResult, type_map } from "./types";

function BuildCollapsibleMeaning(meaning: string[]): HTMLButtonElement {
  const colapsibleButton = document.createElement("button");
  colapsibleButton.classList.add("collapsible");
  colapsibleButton.textContent = meaning.join(", ");
  colapsibleButton.setAttribute("aria-expanded", "false");
  colapsibleButton.addEventListener("click", function () {
    const isExpanded = this.classList.toggle("active");
    this.setAttribute("aria-expanded", String(isExpanded));
  });

  return colapsibleButton;
}

function createWorldBlock(type: string, meanings: string[][]): HTMLElement {
  const block = document.createElement("div");
  block.classList.add("wordblock");

  const typeLabel = document.createElement("span");
  typeLabel.textContent = type;
  typeLabel.classList.add("label");
  block.appendChild(typeLabel);

  const meaningBlock = document.createElement("div");
  meaningBlock.classList.add("meaningblock");
  meanings.forEach((meaning) => {
    const meaningText = document.createElement("span");
    meaningText.classList.add("meaningtext");
    if (meaning.length <= 10) {
      meaningText.textContent = meaning.join(", ");
    } else {
      meaningText.appendChild(BuildCollapsibleMeaning(meaning));
    }
    meaningBlock.appendChild(meaningText);
  });

  block.appendChild(meaningBlock);
  return block;
}

export function createTooltip(data: MeaningResult): HTMLElement {
  const tooltip = document.createElement("div");
  tooltip.classList.add("tooltip");

  const wordTitle = document.createElement("div");
  wordTitle.classList.add("wordtitle");
  const word = document.createElement("strong");
  word.textContent = data.word[0].toUpperCase() + data.word.slice(1);
  word.classList.add("word");
  wordTitle.appendChild(word);
  tooltip.appendChild(wordTitle);

  const sortedMeaning: { [key: string]: string[][] } = {};
  data.meanings.forEach((meaning) => {
    const type = type_map[meaning.pos] || meaning.pos;
    if (!sortedMeaning[type]) {
      sortedMeaning[type] = [];
    }
    sortedMeaning[type].push(meaning.ml);
  });

  for (const type in sortedMeaning) {
    tooltip.appendChild(createWorldBlock(type, sortedMeaning[type]));
  }

  return tooltip;
}

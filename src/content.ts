import { stem } from "./stemmer";
import { style } from "./style";
import { Word, type_map } from "./types";
const tooltipID = "dictionary-tooltip";
const FAV: string = "❤️";
const NOT_FAV: string = "🩶";

function createWorldBlock(type: string, meanings: string[]): HTMLElement {
  const block = document.createElement("div");
  block.classList.add("wordblock");

  const typeLabel = document.createElement("span");
  typeLabel.textContent = type;
  typeLabel.classList.add("label");

  block.appendChild(typeLabel);
  const meaningBloock = document.createElement("div");
  meaningBloock.classList.add("meaningblock");

  meanings.forEach((meaning) => {
    const meaningText = document.createElement("span");
    meaningText.classList.add("meaningtext");
    meaningText.textContent = meaning + ",";

    meaningBloock.appendChild(meaningText);
  });
  block.appendChild(meaningBloock);
  return block;
}

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

function createTooltip(data: Word): HTMLElement {
  const tooltip = document.createElement("div");
  tooltip.classList.add("tooltip");
  const WordTItle = document.createElement("div");
  WordTItle.classList.add("wordtitle");

  const word = document.createElement("strong");
  word.textContent = data.source[0].toUpperCase() + data.source.slice(1);
  word.classList.add("word");

  WordTItle.appendChild(word);
  const response: Promise<boolean> = chrome.runtime.sendMessage({
    action: "isfav",
    word: data.source,
  });
  response.then((isfav) => {
    const fav = document.createElement("button");
    fav.classList.add("fav");
    fav.textContent = isfav ? FAV : NOT_FAV;
    fav.addEventListener("click", (event) => {
      manageFav(event.target as HTMLElement, data.source);
    });
    WordTItle.appendChild(fav);
  });
  tooltip.appendChild(WordTItle);
  let sortedMeaning: { [key: string]: string[] } = {};

  data.values.forEach((word) => {
    let _type: string = type_map[word.type] || word.type;
    if (!sortedMeaning[_type]) {
      sortedMeaning[_type] = [];
    }
    sortedMeaning[_type].push(word.meaning);
  });
  for (const type in sortedMeaning) {
    const meanings = sortedMeaning[type];
    const block = createWorldBlock(type, meanings);
    tooltip.appendChild(block);
  }

  return tooltip;
}

document.addEventListener("mouseup", async (event) => {
  //console.log("Mouse up event detected:", event);
  const target = event.target as HTMLElement;
  const { disabledDomains = {} } = await chrome.storage.local.get([
    "disabledDomains",
  ]);
  const currentDomain = window.location.hostname.replace(/^www\./, "");

  if (
    target.tagName === "INPUT" || // Ignore if the target is an input or
    target.tagName === "TEXTAREA" || // textarea or a content editable element
    target.isContentEditable ||
    disabledDomains[currentDomain]
  ) {
    return;
  }

  let selection = window.getSelection();
  const existingtooltip = document.getElementById(tooltipID);
  if (existingtooltip && !existingtooltip?.contains(target)) {
    existingtooltip.remove(); // Remove existing tooltip if present
  }
  if (existingtooltip && existingtooltip?.contains(target)) {
    selection = null; // selection to null to prevent recursive tooltip calling
  }
  if (
    selection &&
    selection.toString().trim() != "" &&
    selection.toString().trim().split(" ").length === 1
  ) {
    const selectedText = selection.toString().trim();
    console.log(
      "Selected text:",
      selectedText,

      stem(selectedText)
    );

    const response: Promise<Word[]> = chrome.runtime.sendMessage({
      action: "getMeaning",
      word: selectedText,
    });

    response.then((results) => {
      if (results.length > 0) {
        console.log("Received meaning:", results);
        const container = document.createElement("div");
        container.id = tooltipID;
        const tooltipdiv = document.createElement("div");
        tooltipdiv.id = "tooltipdiv";
        const shadow = container.attachShadow({ mode: "open" });
        shadow.appendChild(style);
        for (const result of results) {
          const tooltip = createTooltip(result);
          tooltipdiv.appendChild(tooltip);
        }
        shadow.appendChild(tooltipdiv);
        document.documentElement.lang = "ml";
        document.body.appendChild(container);
        if (selection.rangeCount > 0) {
          const rect = selection.getRangeAt(0).getBoundingClientRect();
          tooltipdiv.style.left = `${rect.left}px`;
          tooltipdiv.style.top = `${rect.bottom + window.scrollY}px`;
          console.log(tooltipdiv);
        }
      }
    });
  }
});

import { Word, type_map } from "./types";
import { stem } from "./stemmer";
const tooltipID = "dictionary-tooltip";
const FAV: string = "❤️";
const NOT_FAV: string = "🩶";
function createWorldBlock(type: string, meanings: string[]): HTMLElement {
  const block = document.createElement("div");
  block.style.marginBottom = "10px";
  block.style.padding = "5px";
  const typeLabel = document.createElement("span");
  typeLabel.textContent = type;
  typeLabel.style.display = "block";
  typeLabel.style.color = "#666";
  typeLabel.style.fontStyle = "italic";
  typeLabel.style.marginBottom = "5px";
  block.appendChild(typeLabel);
  const meaningBloock = document.createElement("div");
  meaningBloock.style.marginLeft = "10px";
  meaningBloock.style.display = "flex";
  meaningBloock.style.flexDirection = "row";
  meaningBloock.style.flexWrap = "wrap";

  meanings.forEach((meaning) => {
    const meaningText = document.createElement("span");
    meaningText.textContent = meaning + ",";
    meaningText.style.display = "block";
    meaningText.style.padding = "2px 5px";
    meaningText.style.marginBottom = "3px";
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

  tooltip.style.display = "flex";
  tooltip.style.flexDirection = "column";
  tooltip.style.border = "1px solid #ccc";
  tooltip.style.padding = "10px";
  tooltip.style.zIndex = "1000";
  tooltip.style.backgroundColor = "#F2F2F2";
  tooltip.style.color = "#222831";
  tooltip.style.color = "black";
  tooltip.style.borderRadius = "5px";

  tooltip.style.fontFamily =
    "'Helvetica Neue', 'Segoe UI', Helvetica, sans-serif";
  const WordTItle = document.createElement("div");
  WordTItle.style.display = "flex";
  WordTItle.style.flexDirection = "row";

  const word = document.createElement("strong");
  word.textContent = data.source[0].toUpperCase() + data.source.slice(1);
  word.style.textAlign = "center";
  word.style.flexGrow = "2";

  WordTItle.appendChild(word);
  const response: Promise<boolean> = chrome.runtime.sendMessage({
    action: "isfav",
    word: data.source,
  });
  response.then((isfav) => {
    const fav = document.createElement("button");
    fav.style.backgroundColor = "transparent";
    fav.style.border = "none";
    fav.style.color = "black";
    fav.textContent = "add";
    fav.style.textAlign = "center";
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

document.addEventListener("mouseup", (event) => {
  //console.log("Mouse up event detected:", event);
  const target = event.target as HTMLElement;
  console.log("Event target:", target);
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return; // Ignore if the target is an input or textarea or a content editable element
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
        const tooltipdiv = document.createElement("div");
        tooltipdiv.id = tooltipID;
        tooltipdiv.style.display = "flex";

        tooltipdiv.style.flexDirection = "column";
        tooltipdiv.style.overflow = "auto";
        tooltipdiv.style.maxHeight = "300px";
        tooltipdiv.style.maxWidth = "400px";

        tooltipdiv.style.position = "absolute";

        for (const result of results) {
          const tooltip = createTooltip(result);
          tooltipdiv.appendChild(tooltip);
        }

        document.documentElement.lang = "ml";
        document.body.appendChild(tooltipdiv);
        if (selection.rangeCount > 0) {
          const rect = selection.getRangeAt(0).getBoundingClientRect();
          tooltipdiv.style.left = `${rect.left}px`;
          tooltipdiv.style.top = `${rect.bottom + window.scrollY}px`;
          console.log(tooltipdiv);
        }
        setTimeout(() => {
          const existingtooltip = document.getElementById(tooltipID);
          if (existingtooltip) {
            existingtooltip.remove();
          }
        }, 10000);
        // Remove after 5 seconds
      }
    });
  }
});

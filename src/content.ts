import { stem } from "./stemmer";
import { style } from "./style";
import { MeaningResult, type_map } from "./types";
const tooltipID = "dictionary-tooltip";

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

function createTooltip(data: MeaningResult): HTMLElement {
  const tooltip = document.createElement("div");
  tooltip.classList.add("tooltip");
  const WordTItle = document.createElement("div");
  WordTItle.classList.add("wordtitle");

  const word = document.createElement("strong");
  word.textContent = data.word[0].toUpperCase() + data.word.slice(1);
  word.classList.add("word");

  WordTItle.appendChild(word);

  tooltip.appendChild(WordTItle);
  let sortedMeaning: { [key: string]: string[] } = {};

  data.meanings.forEach((word) => {
    let _type: string = type_map[word.pos] || word.pos;
    if (!sortedMeaning[_type]) {
      sortedMeaning[_type] = [];
    }
    sortedMeaning[_type].push(word.ml.join(", "));
  });
  for (const type in sortedMeaning) {
    const meanings = sortedMeaning[type];
    const block = createWorldBlock(type, meanings);
    tooltip.appendChild(block);
  }

  return tooltip;
}

async function ShowMeaning(selection: Selection) {
  if (
    !(
      selection &&
      selection.toString().trim() != "" &&
      selection.toString().trim().split(" ").length === 1
    )
  ) {
    return;
  }
  const existingtooltip = document.getElementById(tooltipID);
  if (existingtooltip) {
    existingtooltip.remove();
  }

  const selectedText = selection.toString().trim();
  console.log(
    "Selected text:",
    selectedText,

    stem(selectedText),
  );

  try {
    const results: MeaningResult[] = await chrome.runtime.sendMessage({
      action: "getMeaning",
      word: selectedText,
    });
    if (results.length > 0) {
      console.log("Received meaning:", results);
      const container = document.createElement("div");
      container.id = tooltipID;
      const tooltipdiv = document.createElement("div");
      tooltipdiv.id = "tooltipdiv";
      const shadow = container.attachShadow({ mode: "open" });
      shadow.appendChild(style);
      const close = document.createElement("button");
      close.classList.add("closebutton");
      close.textContent = "×";

      close.addEventListener("click", () => {
        const existingtooltip = document.getElementById(tooltipID);
        if (existingtooltip) {
          selection.removeAllRanges();
          existingtooltip.remove();
        }
      });
      tooltipdiv.appendChild(close);
      for (const result of results) {
        const tooltip = createTooltip(result);
        tooltipdiv.appendChild(tooltip);
      }
      shadow.appendChild(tooltipdiv);
      document.documentElement.lang = "ml";
      document.body.appendChild(container);
      if (selection.rangeCount > 0) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        const tooltipWidth = tooltipdiv.offsetWidth;
        const tooltipHeight = tooltipdiv.offsetHeight;

        let left = rect.left - tooltipWidth - 10;
        if (left < 8) {
          left = rect.right + 10;
        }
        left = Math.min(
          Math.max(8, left),
          Math.max(8, window.innerWidth - tooltipWidth - 8),
        );

        let top = window.scrollY + rect.top;
        if (top + tooltipHeight > window.scrollY + window.innerHeight - 8) {
          top = Math.max(
            8,
            window.scrollY + window.innerHeight - tooltipHeight - 8,
          );
        }

        tooltipdiv.style.left = `${left}px`;
        tooltipdiv.style.top = `${top}px`;
      }
    }
  } catch (e) {
    console.error("Error in fetching meaning:", e);
  }
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
  await ShowMeaning(selection as Selection);
});

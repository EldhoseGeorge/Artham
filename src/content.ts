import { Meaning, type_map } from "./types";
const tooltipID = "dictionary-tooltip";

function createWorldBlock(type: string, meanings: string[]): HTMLElement {
  const block = document.createElement("div");
  block.style.marginBottom = "10px";
  block.style.padding = "5px";
  const typeLabel = document.createElement("strong");
  typeLabel.textContent = type;
  typeLabel.style.display = "block";
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

function createTooltip(data: Meaning[], id: string): HTMLElement {
  const tooltip = document.createElement("div");

  tooltip.id = id;
  tooltip.style.display = "flex";
  tooltip.style.flexDirection = "column";
  tooltip.style.position = "absolute";
  tooltip.style.border = "1px solid #ccc";
  tooltip.style.padding = "10px";
  tooltip.style.zIndex = "1000";
  tooltip.style.backgroundColor = "rgb(123, 211, 234)";
  tooltip.style.color = "black";
  tooltip.style.borderRadius = "5px";
  tooltip.style.fontFamily =
    "'Helvetica Neue', 'Segoe UI', Helvetica, sans-serif";
  let sortedMeaning: { [key: string]: string[] } = {};

  data.forEach((word) => {
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
  const existingtooltip = document.getElementById(tooltipID);
  if (existingtooltip) {
    existingtooltip.remove(); // Remove existing tooltip if present
  }
  //console.log("Mouse up event detected:", event);
  const selection = window.getSelection();
  if (
    selection &&
    selection.toString().trim() != "" &&
    selection.toString().trim().split(" ").length === 1
  ) {
    const selectedText = selection.toString().trim();

    const response: Promise<Meaning[]> = chrome.runtime.sendMessage({
      action: "getMeaning",
      word: selectedText,
    });

    response.then((result) => {
      if (result.length > 0) {
        //console.log("Received meaning:", result);

        const tooltip = createTooltip(result, tooltipID);
        document.documentElement.lang = "ml";
        document.body.appendChild(tooltip);
        if (selection.rangeCount > 0) {
          const rect = selection.getRangeAt(0).getBoundingClientRect();
          tooltip.style.left = `${rect.left}px`;
          tooltip.style.top = `${rect.bottom + window.scrollY}px`;
          console.log(tooltip);
        }
        setTimeout(() => {
          document.body.removeChild(tooltip);
        }, 5000);
        // Remove after 5 seconds
      }
    });
  }
});

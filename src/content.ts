import { Meaning } from "./types";
const tooltipID = "dictionary-tooltip";
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

        const tooltip = document.createElement("div");
        tooltip.id = tooltipID;
        tooltip.style.position = "absolute";
        tooltip.style.border = "1px solid #ccc";
        tooltip.style.padding = "10px";
        tooltip.style.zIndex = "1000";
        tooltip.style.backgroundColor = "rgba(148, 145, 145, 0.91)";
        tooltip.style.color = "black";
        tooltip.style.borderRadius = "5px";
        let sortedMeaning: { [key: string]: string[] } = {};
        result.forEach((word) => {
          if (!sortedMeaning[word.type]) {
            sortedMeaning[word.type] = [];
          }
          sortedMeaning[word.type].push(word.meaning);
        });
        tooltip.innerHTML = Object.entries(sortedMeaning)
          .map(([type, meanings]) => `<em>${type}:</em> ${meanings.join(", ")}`)
          .join("<br>");
        document.body.appendChild(tooltip);

        const rect = selection.getRangeAt(0).getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + window.scrollY}px`;
        console.log(tooltip);
        setTimeout(() => {
          document.body.removeChild(tooltip);
        }, 5000); // Remove after 5 seconds
      }
    });
  }
});

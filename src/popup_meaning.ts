import { MeaningResult } from "./types";
import { style } from "./style";
import { createTooltip } from "./tooltip";
window.document.addEventListener("DOMContentLoaded", () => {
  document.head.appendChild(style);
  const url = new URL(window.location.href);
  const data = url.searchParams.get("data");
  if (data) {
    const meanings: MeaningResult[] = JSON.parse(
      decodeURIComponent(data),
    ) as MeaningResult[];
    let container: Element | null =
      document.getElementById("meaning-container");
    meanings.forEach((word) => {
      //let meaning = await createMeaningCard(word);
      let meaning = createTooltip(word);
      container?.appendChild(meaning);
    });
  }
});

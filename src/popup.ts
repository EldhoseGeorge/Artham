// Wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dict-form");
  const domainSpan = document.getElementById("domain-name");
  const toggle = document.getElementById("dict-toggle") as HTMLInputElement;
  const label = document.getElementById("toggle-label");
  let currentDomain = "";

  // Fetch and display the domain name of the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && domainSpan && form) {
      try {
        const url = new URL(tab.url);

        // Check if it's a regular web page (not chrome://, chrome-extension://, etc.)
        if (url.protocol === "http:" || url.protocol === "https:") {
          currentDomain = url.hostname.replace(/^www\./, "");
          domainSpan.textContent = currentDomain;
          form.style.display = "flex";

          // Fetch per-domain setting from storage
          chrome.storage.local.get(["disabledDomains"], (data) => {
            const disabledDomains = data.disabledDomains || {};
            const isDisabled = !disabledDomains[currentDomain];
            toggle.checked = isDisabled; // checked means enabled
            if (label) label.textContent = isDisabled ? "ENABLED" : "DISABLED";
          });
        } else {
          form.style.display = "none";
        }
      } catch (e) {
        domainSpan.textContent = "";
        if (label) label.textContent = "";
      }
    }
  });

  // Listen for toggle changes
  toggle.addEventListener("change", () => {
    if (!currentDomain) return;
    // checked means enabled
    const isEnabled = toggle.checked;

    // Update label
    if (label) label.textContent = isEnabled ? "ENABLED" : "DISABLED";

    // Update storage
    chrome.storage.local.get(["disabledDomains"], (data) => {
      const disabledDomains = data.disabledDomains || {};
      if (!isEnabled) {
        // Disabled: add to disabledDomains
        disabledDomains[currentDomain] = true;
      } else {
        // Enabled: remove from disabledDomains
        delete disabledDomains[currentDomain];
      }
      chrome.storage.local.set({ disabledDomains });
    });
  });
});

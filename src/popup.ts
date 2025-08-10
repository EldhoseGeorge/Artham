// Wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
  // Get all radio buttons with name 'enable_option'
  const radios = document.querySelectorAll<HTMLInputElement>(
    'input[name="dictionary-status"]'
  );

  // Fetch stored value and preselect the radio button
  chrome.storage.local.get("dictionaryStatus", (data) => {
    const storedValue = data.dictionaryStatus;

    if (storedValue) {
      const radioToSelect = Array.from(radios).find(
        (radio) => radio.value === storedValue
      );
      if (radioToSelect) {
        radioToSelect.checked = true;
        console.log("Preselected radio:", radioToSelect.value);
      }
    }
  });

  // Function to get the currently selected value
  function getSelectedOption(): string | null {
    const checked = Array.from(radios).find((radio) => radio.checked);
    return checked ? checked.value : null;
  }

  // Listen for changes on any radio button
  radios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const selected = getSelectedOption();
      console.log("Selected option:", selected);
      chrome.runtime.sendMessage({
        action: "storeDictionaryStatus",
        option: selected,
      });
    });
  });

  // Optionally, log the initial value
  console.log("Initial selected option:", getSelectedOption());
});

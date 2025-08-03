import Fuse from "fuse.js";
import { stem } from "./stemmer";
import { Dictionary, Word } from "./types";
const DB_NAME: string = "db_dictionary";
const OBJECT_STORE_NAME: string = "engmal";
const DB_VERSION: number = 1;
let DB_INSTANCE: IDBDatabase | null = null;
const SELECTED_OPTION_KEY = "selectedOption";
const SELECTED_OPTION_KEY_DEFAULT = "select_word";

function localStorageInit() {
  chrome.storage.local.get([SELECTED_OPTION_KEY], (result) => {
    // console.log("Current selected option:", result[SELECTED_OPTION_KEY]);
    if (result[SELECTED_OPTION_KEY] === undefined) {
      chrome.storage.local.set({
        [SELECTED_OPTION_KEY]: SELECTED_OPTION_KEY_DEFAULT,
      });
    }
  });
}
localStorageInit();

async function getMeaning(requestWord: string): Promise<Word[]> {
  // console.log("Received request for word:", requestWord);
  const word = requestWord.toLowerCase().trim();
  const result: Word | undefined | Word[] = await queryDictionary(word);
  // console.log(result);
  if (result) {
    return result as Word[];
  } else {
    const stemmedWord = stem(word);
    const stemmedResult: Word[] | undefined = await queryDictionary(
      stemmedWord,

      true
    );
    if (stemmedResult) {
      const search = new Fuse(stemmedResult, {
        keys: ["source"],
        threshold: 0.6,
        includeScore: true,
      });
      const fuzzy_result = search.search(word);
      const result: Word[] = fuzzy_result.map((item) => item.item);
      return result;
    } else {
      return [];
    }
  }
}

function updateContextMenu() {
  chrome.storage.local.get("selectedOption", (data) => {
    // console.log("data from storage:", data);
    const isRightClickMode = data.selectedOption === "right_click";

    // Remove old menu item (if any)
    chrome.contextMenus.removeAll();

    // Add "Translate to Malayalam" only if in right_click mode
    if (isRightClickMode) {
      console.log("Adding context menu for right click mode laaaaaaaa");
      chrome.contextMenus.create({
        id: "translate_malayalam",
        title: "Translate to Malayalam",
        contexts: ["selection"], // Only show when text is selected
      });
    }
  });
}

function getDictionaryData(): Promise<Dictionary> {
  return fetch(chrome.runtime.getURL("/data/enml.json"))
    .then((response) => response.json())
    .then((data: Dictionary) => data);
}

function getDB(): Promise<IDBDatabase> {
  //a singleton class to return the db instance
  return new Promise((resolve, reject) => {
    if (DB_INSTANCE) {
      resolve(DB_INSTANCE);
    } else {
      const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        DBinit(event);
      };
      request.onsuccess = (event) => {
        DB_INSTANCE = request.result;
        resolve(DB_INSTANCE);
      };
      request.onerror = (event) => {
        console.error(
          "Database error:",
          (event?.target as IDBOpenDBRequest)?.error?.message
        );
        reject((event?.target as IDBOpenDBRequest)?.error?.message);
      };
    }
  });
}

function DBinit(event: IDBVersionChangeEvent) {
  console.log("Initializing database:", DB_NAME);
  const db = (event.target as IDBOpenDBRequest).result;
  if (db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
    db.deleteObjectStore(OBJECT_STORE_NAME);
    console.log("Deleted existing object store:", OBJECT_STORE_NAME);
  }
  console.log("Creating object store:", OBJECT_STORE_NAME);
  const objectStore: IDBObjectStore = db.createObjectStore(OBJECT_STORE_NAME, {
    keyPath: "source",
  });
  objectStore.createIndex("stem", "stem", { unique: false });
  objectStore.transaction.oncomplete = (event) => {
    getDictionaryData().then((data: Dictionary) => {
      const dataObjectStore: IDBObjectStore = db
        .transaction(OBJECT_STORE_NAME, "readwrite")
        .objectStore(OBJECT_STORE_NAME);
      data?.data.forEach((item: Word) => {
        item.stem = stem(item.source);
        dataObjectStore.add(item);
      });
    });
  };
}

function queryDictionary(
  word: string,
  index_name: boolean = false
): Promise<Word[] | undefined> {
  console.log("Querying dictionary for word:", word);
  return new Promise<Word[] | undefined>((resolve, reject) => {
    getDB().then((db: IDBDatabase) => {
      const transaction: IDBTransaction = db.transaction(
        OBJECT_STORE_NAME,
        "readonly"
      );
      const objectStore: IDBObjectStore =
        transaction.objectStore(OBJECT_STORE_NAME);
      if (index_name) {
        const index: IDBIndex = objectStore.index("stem");
        index.getAll(word).onsuccess = (event) => {
          const result: Word[] | undefined = (
            event.target as IDBRequest<Word[]>
          ).result;

          resolve(result || undefined);
        };
      } else {
        const getRequest: IDBRequest<Word> = objectStore.get(word);
        getRequest.onsuccess = (event) => {
          const result: Word | undefined = (event.target as IDBRequest<Word>)
            .result;
          if (result) {
            resolve([result]);
          } else {
            resolve(undefined);
          }
        };
        getRequest.onerror = (event) => {
          console.error("Error fetching word:", event);
          resolve(undefined);
        };
      }
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  (async () => {
    await getDB();
  })();
  updateContextMenu();
  return true;
});

chrome.runtime.onMessage.addListener(
  (
    request: { action: string; word: string; option?: string },
    sender,
    sendResponse
  ) => {
    if (request.action === "getMeaning") {
      (async () => {
        const result = await getMeaning(request.word);
        // console.log("Sending response for getMeaning:", result);
        sendResponse(result);
      })();
      return true; // Indicates that the response will be sent synchronously
    }
    if (request.action === "storeSelectedOption") {
      // console.log("Storing selected option:", request);
      chrome.storage.local.set({ selectedOption: request.option }, () => {
        // console.log("Selected option stored successfully.");
      });
      return true; // Indicates that the response will be sent asynchronously
    }
    return false; // No response needed for other actions
  }
);

// Listen for storage changes (if option is updated elsewhere)
chrome.storage.onChanged.addListener(() => {
  // console.log("Storage changed, updating context menu...");
  updateContextMenu();
});

chrome.contextMenus.onClicked.addListener(
  async (info: chrome.contextMenus.OnClickData, tab) => {
    if (info.menuItemId === "translate_malayalam" && tab?.id) {
      const word = info.selectionText;
      console.log("Context menu clicked for translation:", info);
      if (
        word &&
        word.toString().trim() != "" &&
        word.toString().trim().split(" ").length === 1
      ) {
        const results = await getMeaning(word);
        chrome.tabs.sendMessage(tab.id, {
          action: "showTooltip",
          data: results,
        });
      }
    }
  }
);

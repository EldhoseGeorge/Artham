import { Meaning, Word, Dictionary } from "./types";
const db_name: string = "db_dictionary";
const object_store_name: string = "engmal";

function getDictionaryData(): Promise<Dictionary> {
  return fetch(chrome.runtime.getURL("/data/enml.json"))
    .then((response) => response.json())
    .then((data: Dictionary) => data);
}

async function backgroundWorkerDBinit(): Promise<any> {
  const request: IDBOpenDBRequest = indexedDB.open(db_name, 1);
  request.onerror = (event) => {
    console.error(
      "Database error:",
      (event?.target as IDBOpenDBRequest)?.error?.message
    );
  };
  request.onupgradeneeded = (event) => {
    const db = (event.target as IDBOpenDBRequest).result;
    if (!db.objectStoreNames.contains(object_store_name)) {
      console.log("Creating object store:", object_store_name);
      const objectStore: IDBObjectStore = db.createObjectStore(
        object_store_name,
        { keyPath: "source" }
      );
      objectStore.transaction.oncomplete = (event) => {
        getDictionaryData().then((data: Dictionary) => {
          const dataObjectStore: IDBObjectStore = db
            .transaction(object_store_name, "readwrite")
            .objectStore(object_store_name);
          data?.data.forEach((item: Word) => {
            dataObjectStore.add(item);
          });
        });
      };
    }
  };
  request.onsuccess = (event) => {
    const db = (event.target as IDBOpenDBRequest).result;
    //console.log("Database opened successfully:", db_name);
  };
}

backgroundWorkerDBinit();

chrome.runtime.onMessage.addListener(
  (request: { action: string; word: string }, sender, sendResponse) => {
    if (request.action === "getMeaning") {
      const word = request.word.toLowerCase().trim();
      const dbRequest: IDBOpenDBRequest = indexedDB.open(db_name, 1);
      dbRequest.onsuccess = (event) => {
        const db: IDBDatabase = (event.target as IDBOpenDBRequest).result;
        const transaction: IDBTransaction = db.transaction(
          object_store_name,
          "readonly"
        );
        const objectStore: IDBObjectStore =
          transaction.objectStore(object_store_name);
        const getRequest: IDBRequest<Word> = objectStore.get(word);
        getRequest.onsuccess = (event) => {
          const result: Word | undefined = (event.target as IDBRequest<Word>)
            .result;
          if (result) {
            sendResponse(result.values);
          } else {
            sendResponse([]);
          }
        };
        getRequest.onerror = (event) => {
          console.error("Error fetching word:", event);
          sendResponse([]);
        };
      };
      return true; // Indicates that the response will be sent asynchronously
    }
  }
);

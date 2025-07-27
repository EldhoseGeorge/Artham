import { Meaning, Word, Dictionary } from "./types";
import { stem } from "./stemmer";
import Fuse from "fuse.js";
const DB_NAME: string = "db_dictionary";
const OBJECT_STORE_NAME: string = "engmal";
const DB_VERSION: number = 6;
let DB_INSTANCE: IDBDatabase | null = null;

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
  return true;
});

chrome.runtime.onMessage.addListener(
  (request: { action: string; word: string }, sender, sendResponse) => {
    if (request.action === "getMeaning") {
      (async () => {
        console.log("Received request for word:", request.word);
        const word = request.word.toLowerCase().trim();
        const result: Word | undefined | Word[] = await queryDictionary(word);
        console.log(result);
        if (result) {
          sendResponse(result as Word[]);
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
            sendResponse(result);
          } else {
            sendResponse([]);
          }
        }
      })();
      return true; // Indicates that the response will be sent asynchronously
    }
  }
);

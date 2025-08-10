import { Meaning, Word, Dictionary } from "./types";
import { stem } from "./stemmer";
import Fuse from "fuse.js";
const DB_NAME: string = "db_dictionary";
const OBJECT_STORE_NAME: string = "engmal";
const FAV_OBJECT_STORE_NAME = "fav";
const DB_VERSION: number = 7;
let DB_INSTANCE: IDBDatabase | null = null;

function getDictionaryData(): Promise<Dictionary> {
  return fetch(chrome.runtime.getURL("/data/enml.json"))
    .then((response) => response.json())
    .then((data: Dictionary) => data);
}
function withStore<T>(
  objStoreName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<void | T> {
  return getDB().then((db) => {
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(objStoreName, mode);
      const store = tx.objectStore(objStoreName);
      const request = callback(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
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
      request.onblocked = () => {
        console.log("db upgrade blocked");
      };
      request.onsuccess = (event) => {
        DB_INSTANCE = request.result;
        DB_INSTANCE.onclose = () => (DB_INSTANCE = null);
        resolve(DB_INSTANCE);
      };
      request.onerror = (event) => {
        console.error(
          "Database error:",
          (event?.target as IDBOpenDBRequest)?.error?.message
        );
        DB_INSTANCE = null;
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
  const favObjectStore: IDBObjectStore = db.createObjectStore(
    FAV_OBJECT_STORE_NAME,
    { keyPath: "word" }
  );
}

function isFavWord(word: string): Promise<boolean> {
  return withStore<Word>(FAV_OBJECT_STORE_NAME, "readonly", (store) =>
    store.get(word)
  ).then((result) => !!result);
}

function removeFav(word: string): Promise<boolean> {
  return withStore<undefined>(FAV_OBJECT_STORE_NAME, "readwrite", (store) =>
    store.delete(word)
  ).then(() => false);
}
function addFav(word: string): Promise<boolean> {
  return withStore(FAV_OBJECT_STORE_NAME, "readwrite", (store) =>
    store.put({
      word: word,
      time: Date.now(),
    })
  ).then(() => true);
}
function queryDictionaryByWordRange(
  word: string,
  orginalWord: string
): Promise<Word[] | undefined> {
  return getDB().then((db) => {
    return new Promise<Word[] | undefined>((resolve, reject) => {
      const tx = db.transaction(OBJECT_STORE_NAME, "readonly");
      const store = tx.objectStore(OBJECT_STORE_NAME);
      const bound = IDBKeyRange.bound(word, word + "\uffff", true);
      const request = store.openCursor(bound);

      const items: Word[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue | null;
        if (cursor) {
          items.push(cursor.value as Word);
          cursor.continue(); // move to next record
        } else {
          console.log(cursor);
          if (items && items.length > 0) {
            const search = new Fuse(items, {
              keys: ["source"],
              threshold: 0.6,
              includeScore: true,
            });
            const fuzzy_result = search.search(orginalWord);
            const topResult: Word[] = fuzzy_result.map((item) => item.item);
            resolve(topResult);
          } else {
            resolve(undefined);
          }
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  });
}

function queryDictionaryByStem(word: string): Promise<Word[] | undefined> {
  const stemmedWord = stem(word);
  return withStore<Word[]>(OBJECT_STORE_NAME, "readonly", (store) =>
    store.index("stem").getAll(stemmedWord)
  )
    .then((result) => {
      if (result && result.length > 0) {
        const search = new Fuse(result, {
          keys: ["source"],
          threshold: 0.6,
          includeScore: true,
        });
        const fuzzy_result = search.search(word);
        const topResult: Word[] = fuzzy_result.map((item) => item.item);
        return topResult;
      }
      return undefined;
    })
    .catch((err) => {
      console.error("Error fetching word:", err);
      return undefined;
    });
}
function queryDictionaryByword(word: string): Promise<Word[] | undefined> {
  return withStore<Word>(OBJECT_STORE_NAME, "readonly", (store) =>
    store.get(word)
  )
    .then((result) => {
      if (result) {
        return [result];
      }
      return undefined;
    })
    .catch((err) => {
      console.error("Error fetching word:", err);
      return undefined;
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
        let result: undefined | Word[] = [];
        let currentWord: string = word;
        result =
          (await queryDictionaryByword(currentWord)) ||
          (await queryDictionaryByStem(currentWord)) ||
          undefined;
        if (result) {
          console.log(result);
          sendResponse(result);
        } else {
          while (currentWord.length > Math.trunc(word.length / 2)) {
            // We try exact match first since most queries succeed directly.
            // Stem search is used only if exact match fails.
            // This avoids extra IndexedDB calls in the common case.

            currentWord = currentWord.slice(0, currentWord.length - 1);
            result = await queryDictionaryByWordRange(currentWord, word);
            if (result) break;
          }
          sendResponse(result || []);
        }
      })();
      return true; // Indicates that the response will be sent asynchronously
    } else if (request.action == "isfav") {
      (async () => {
        const res = await isFavWord(request.word);
        sendResponse(res);
      })();
      return true;
    } else if (request.action == "fav") {
      (async () => {
        const isfav = await isFavWord(request.word);
        console.log(isfav);
        if (isfav) {
          const res = await removeFav(request.word);

          sendResponse(res);
        } else {
          const res = await addFav(request.word);

          sendResponse(res);
        }
      })();
      return true;
    }
  }
);

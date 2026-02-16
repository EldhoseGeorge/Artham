import Fuse from "fuse.js";
import { stem } from "./stemmer";
import {
  DictionaryEntry,
  FlattenedEntry,
  Word,
  MeaningResult,
  MeaningBlock,
} from "./types";
const DB_NAME: string = "db_dictionary";
const OBJECT_STORE_NAME: string = "engmal";
const FLATTENED_OBJECT_STORE_NAME: string = "engmal_flat";
const FAV_OBJECT_STORE_NAME = "fav";
const DB_VERSION: number = 1;
const TOP_N = 5;
const FUZZY_THRESHOLD = 0.4;
const MIN_LENGTH = 6;
const RANGE_LIMIT = 50;
let POPUP_WINDOW_ID: number | undefined = undefined;
let DB_INSTANCE: IDBDatabase | null = null;

async function flushBatch<T>(
  batch: T[],
  db: IDBDatabase,
  objectStore: string,
): Promise<void> {
  if (batch.length === 0) return;
  const tx = db.transaction(objectStore, "readwrite");
  const store = tx.objectStore(objectStore);

  batch.forEach((w) => {
    store.put(w);
  });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

async function streamJSONLinesGzip<T>(
  url: string,
  db: IDBDatabase,
  batchSize: number = 500,
  processBatch: (batch: T[]) => Promise<void>,
): Promise<void> {
  console.log("Starting to stream and process JSON lines");

  const response = await fetch(url);
  const stream = response.body
    ?.pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new TextDecoderStream());
  if (!stream) throw new Error("Failed to get response stream");

  const reader = stream.getReader();
  let buffer = "";
  let batch: T[] = [];
  let { value, done } = await reader.read();
  while (!done) {
    buffer += value ?? "";
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const item: T = JSON.parse(line);
      batch.push(item);
      if (batch.length >= batchSize) {
        await processBatch(batch);
        batch = []; // Clear batch after processing
      }
    }

    ({ value, done } = await reader.read());
  }

  if (buffer.trim()) {
    const item: T = JSON.parse(buffer);
    batch.push(item);
  }

  await processBatch(batch);
}

async function withStore<T>(
  objStoreName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
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
          (event?.target as IDBOpenDBRequest)?.error?.message,
        );
        DB_INSTANCE = null;
        reject((event?.target as IDBOpenDBRequest)?.error?.message);
      };
    }
  });
}

async function DBinit(event: IDBVersionChangeEvent) {
  console.log("Initializing database:", DB_NAME);
  const db = (event.target as IDBOpenDBRequest).result;
  if (db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
    db.deleteObjectStore(OBJECT_STORE_NAME);
    console.log("Deleted existing object store:", OBJECT_STORE_NAME);
  }
  if (db.objectStoreNames.contains(FAV_OBJECT_STORE_NAME)) {
    db.deleteObjectStore(FAV_OBJECT_STORE_NAME);
    console.log("Deleted existing object store:", FAV_OBJECT_STORE_NAME);
  }
  if (db.objectStoreNames.contains(FLATTENED_OBJECT_STORE_NAME)) {
    db.deleteObjectStore(FLATTENED_OBJECT_STORE_NAME);
    console.log("Deleted existing object store:", FLATTENED_OBJECT_STORE_NAME);
  }

  console.log("Creating object store:", OBJECT_STORE_NAME);
  const objectStore: IDBObjectStore = db.createObjectStore(OBJECT_STORE_NAME, {
    keyPath: "head",
  });
  console.log("created object store:", FLATTENED_OBJECT_STORE_NAME);
  const flattenedObjectStore: IDBObjectStore = db.createObjectStore(
    FLATTENED_OBJECT_STORE_NAME,
    {
      keyPath: "word",
    },
  );

  console.log("Creating index on 'stem' field");
  flattenedObjectStore.createIndex("stem", "stem", { unique: false });
  const transactionDone = (transaction: IDBTransaction) => {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () =>
        resolve("Transaction completed successfully");
      transaction.onerror = () => reject(transaction.error);
    });
  };
  (async () => {
    await Promise.all([
      transactionDone(objectStore.transaction),
      transactionDone(flattenedObjectStore.transaction),
    ]);
  })();
  console.log("Starting to stream JSON lines into the database");
  try {
    await streamJSONLinesGzip<DictionaryEntry>(
      chrome.runtime.getURL("data/ekkurup.jsonl.gz"),
      db,
      500,
      (currentBatch) => flushBatch(currentBatch, db, OBJECT_STORE_NAME),
    );
    await streamJSONLinesGzip<FlattenedEntry>(
      chrome.runtime.getURL("data/ekkurup_flaten.jsonl.gz"),
      db,
      500,
      (currentBatch) => {
        for (const entry of currentBatch) {
          entry.stem = stem(entry.word);
        }
        return flushBatch(currentBatch, db, FLATTENED_OBJECT_STORE_NAME);
      },
    );
  } catch (e) {
    console.error("Error during database initialization:", e);
  }
  console.log("Database initialization completed");
}

async function isFavWord(word: string): Promise<boolean> {
  return withStore<Word>(FAV_OBJECT_STORE_NAME, "readonly", (store) =>
    store.get(word),
  ).then((result) => !!result);
}

async function removeFav(word: string): Promise<boolean> {
  return withStore<undefined>(FAV_OBJECT_STORE_NAME, "readwrite", (store) =>
    store.delete(word),
  ).then(() => false);
}

async function addFav(word: string): Promise<boolean> {
  return withStore(FAV_OBJECT_STORE_NAME, "readwrite", (store) =>
    store.put({
      word: word,
      time: Date.now(),
    }),
  ).then(() => true);
}

async function queryDictionaryByWordRange(
  word: string,
  orginalWord: string,
): Promise<FlattenedEntry[] | []> {
  return getDB().then((db) => {
    return new Promise<FlattenedEntry[] | []>((resolve, reject) => {
      const tx = db.transaction(FLATTENED_OBJECT_STORE_NAME, "readonly");
      const store = tx.objectStore(FLATTENED_OBJECT_STORE_NAME);
      const bound = IDBKeyRange.bound(word, word + "\uffff", true);
      const request = store.openCursor(bound);

      const items: FlattenedEntry[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue | null;

        if (cursor && items.length < RANGE_LIMIT) {
          items.push(cursor.value as FlattenedEntry);

          cursor.continue(); // move to next record
        } else {
          console.log(cursor);
          if (items && items.length > 0) {
            const search = new Fuse(items, {
              keys: ["word"],
              threshold: FUZZY_THRESHOLD,
              includeScore: true,
            });
            const fuzzy_result = search.search(orginalWord);
            console.log(fuzzy_result);
            const topResult: FlattenedEntry[] = fuzzy_result
              .slice(0, TOP_N)
              .map((item) => item.item);
            resolve(topResult);
          } else {
            resolve([]);
          }
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  });
}

async function getHead(head: string): Promise<DictionaryEntry | undefined> {
  return withStore<DictionaryEntry>(OBJECT_STORE_NAME, "readonly", (store) =>
    store.get(head),
  )
    .then((result) => {
      console.log("Fetched head data for:", head, result); // Debug log
      if (result) {
        return result;
      }
      return undefined;
    })
    .catch((err) => {
      console.error("Error fetching word:", err);
      return undefined;
    });
}

async function selectHeads(
  data: FlattenedEntry[],
): Promise<MeaningResult[] | []> {
  const result: MeaningResult[] = [];

  for (const entry of data) {
    const heads = entry.heads;
    heads.sort((a, b) => {
      return a[1] - b[1] || a[2] - b[2];
    });
    const searchHead = heads[0][0];
    const WordIndex = Math.max(Number(heads[0][2]), 0);
    const WordPOS = heads[0][3];
    console.log("Selected head:", searchHead);
    const headData = await getHead(searchHead);
    if (headData) {
      const _temp: MeaningResult = {
        word: entry.word,
        meanings: headData.senses
          .filter((sense) => {
            const isMatch = sense.pos == WordPOS || WordPOS == "h";
            console.log(`Checking ${sense.pos} against ${WordPOS}: ${isMatch}`);
            return isMatch;
          })
          .map((sense) => ({
            pos: sense.pos,
            ml: sense.ml.flat().slice(WordIndex, WordIndex + 10),
          })),
      };
      result.push(_temp);
    }
  }
  console.log(result);
  return result;
}

async function queryDictionaryByStem(
  word: string,
): Promise<FlattenedEntry[] | []> {
  const stemmedWord = stem(word);
  return withStore<FlattenedEntry[]>(
    FLATTENED_OBJECT_STORE_NAME,
    "readonly",
    (store) => store.index("stem").getAll(stemmedWord),
  )
    .then((result) => {
      if (result && result.length > 0) {
        const search = new Fuse(result, {
          keys: ["word"],
          threshold: FUZZY_THRESHOLD,
          includeScore: true,
        });
        const fuzzy_result = search.search(word);
        const topResult: FlattenedEntry[] = fuzzy_result
          .slice(0, TOP_N)
          .map((item) => item.item);
        return topResult;
      }
      return [];
    })
    .catch((err) => {
      console.error("Error fetching word:", err);
      return [];
    });
}

async function queryDictionaryByword(
  word: string,
): Promise<FlattenedEntry[] | []> {
  return withStore<FlattenedEntry>(
    FLATTENED_OBJECT_STORE_NAME,
    "readonly",
    (store) => store.get(word),
  )
    .then((result) => {
      if (result) {
        return [result];
      }
      return [];
    })
    .catch((err) => {
      console.error("Error fetching word:", err);
      return [];
    });
}
async function getFavWords(lastWord: string): Promise<string[]> {
  try {
    const db = await getDB();
    const tx = db.transaction(FAV_OBJECT_STORE_NAME, "readonly");
    const store = tx.objectStore(FAV_OBJECT_STORE_NAME);
    const bound = IDBKeyRange.lowerBound(lastWord, true);
    return new Promise<string[]>((resolve, reject) => {
      const request = store.getAllKeys(bound, RANGE_LIMIT);

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (e) {
    console.error("Error fetching favorite words:", e);
    return [];
  }
}

async function queryDictionary(_word: string): Promise<MeaningResult[] | []> {
  const word = _word.toLowerCase().trim();
  let result: [] | FlattenedEntry[] = [];
  let currentWord: string = word;
  result = await queryDictionaryByword(currentWord);
  if (result.length == 0) {
    result = await queryDictionaryByStem(currentWord);
  }

  if (result.length > 0) {
    return await selectHeads(result);
  } else if (word.length >= MIN_LENGTH) {
    while (currentWord.length > Math.trunc(word.length / 2)) {
      // We try exact match first since most queries succeed directly.
      // Stem search is used only if exact match fails.
      // This avoids extra IndexedDB calls in the common case.

      currentWord = currentWord.slice(0, currentWord.length - 1);
      result = await queryDictionaryByWordRange(currentWord, word);
      if (result.length > 0) break;
    }

    return await selectHeads(result);
  }
  return [];
}
function createPopUpWindow(url: string) {
  chrome.windows.create(
    {
      url: url,
      type: "popup",
      width: 450,
      height: 600,
      left: 500,
    },
    (window) => {
      POPUP_WINDOW_ID = window?.id;
    },
  );
}
chrome.runtime.onInstalled.addListener(() => {
  (async () => {
    await getDB();
    chrome.contextMenus.create({
      id: "malayalam_meaning",
      title: "മലയാള അർത്ഥം",
      contexts: ["selection"],
    });
  })();
  return true;
});
chrome.windows.onRemoved.addListener((windowId) => {
  if (POPUP_WINDOW_ID === windowId) {
    POPUP_WINDOW_ID = undefined;
  }
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "malayalam_meaning" && info.selectionText) {
    try {
      const meanings: MeaningResult[] = await queryDictionary(
        info.selectionText,
      );
      if (meanings.length > 0) {
        console.log("Context menu meanings:", meanings);
        const url: string =
          chrome.runtime.getURL("popup_meaning.html") +
          "?data=" +
          encodeURIComponent(JSON.stringify(meanings));
        if (POPUP_WINDOW_ID) {
          chrome.windows.update(
            POPUP_WINDOW_ID,
            { focused: true },
            (window) => {
              if (chrome.runtime.lastError || !window) {
                createPopUpWindow(url);
              } else {
                chrome.tabs.update(window.tabs?.[0].id, { url: url });
              }
            },
          );
        } else {
          createPopUpWindow(url);
        }
      }
    } catch (e) {
      console.error("Error in context menu click handler:", e);
    }
  }
});
chrome.runtime.onMessage.addListener(
  (request: { action: string }, sender, sendResponse) => {
    if (request.action == "deleteAllFav") {
      (async () => {
        await withStore(FAV_OBJECT_STORE_NAME, "readwrite", (store) =>
          store.clear(),
        );
        sendResponse(true);
      })();
    }
  },
);
chrome.runtime.onMessage.addListener(
  (request: { action: string; word: string }, sender, sendResponse) => {
    if (request.action === "getMeaning") {
      (async () => {
        const res: MeaningResult[] = await queryDictionary(request.word);
        sendResponse(res);
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
    } else if (request.action == "getFavWords") {
      (async () => {
        const lastword: string = request.word.toLowerCase().trim();
        const favWords: string[] = await getFavWords(lastword);
        sendResponse(favWords);
      })();
      return true;
    } else if (request.action === "removeFav") {
      (async () => {
        const res = await removeFav(request.word);
        sendResponse(res);
      })();
      return true;
    }
    {
      return false; // Unrecognized action
    }
  },
);

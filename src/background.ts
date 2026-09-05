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
const DB_VERSION: number = 1;
const TOP_N = 5;
const FUZZY_THRESHOLD = 0.4;
const MIN_LENGTH = 6;
const RANGE_LIMIT = 50;
const MAX_LEN_IN_RESULT_SET = 3;
let POPUP_WINDOW_ID: number | undefined = undefined;
let DB_INSTANCE: IDBDatabase | null = null;
let DB_PROMISE: Promise<IDBDatabase> | null = null;

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
  // Return the cached promise so all concurrent callers share one connection
  if (DB_PROMISE) return DB_PROMISE;

  DB_PROMISE = new Promise((resolve, reject) => {
    if (DB_INSTANCE) {
      resolve(DB_INSTANCE);
      return;
    }

    let needsPopulation = false;
    const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      needsPopulation = true;
      initSchema(event);
    };
    request.onblocked = () => {
      console.log("db upgrade blocked");
    };
    request.onsuccess = async () => {
      DB_INSTANCE = request.result;

      DB_INSTANCE.onclose = () => {
        DB_INSTANCE = null;
        DB_PROMISE = null;
      };

      if (needsPopulation) {
        await populateDB(DB_INSTANCE);
      }

      resolve(DB_INSTANCE);
    };
    request.onerror = (event) => {
      console.error(
        "Database error:",
        (event?.target as IDBOpenDBRequest)?.error?.message,
      );
      DB_INSTANCE = null;
      DB_PROMISE = null;
      reject((event?.target as IDBOpenDBRequest)?.error?.message);
    };
  });
  return DB_PROMISE;
}

/**
 * Synchronous schema creation — safe to run inside onupgradeneeded.
 * Only creates/deletes object stores and indices. No async work.
 */
function initSchema(event: IDBVersionChangeEvent) {
  console.log("Initializing database schema:", DB_NAME);
  const db = (event.target as IDBOpenDBRequest).result;

  if (db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
    db.deleteObjectStore(OBJECT_STORE_NAME);
    console.log("Deleted existing object store:", OBJECT_STORE_NAME);
  }

  if (db.objectStoreNames.contains(FLATTENED_OBJECT_STORE_NAME)) {
    db.deleteObjectStore(FLATTENED_OBJECT_STORE_NAME);
    console.log("Deleted existing object store:", FLATTENED_OBJECT_STORE_NAME);
  }

  console.log("Creating object store:", OBJECT_STORE_NAME);
  db.createObjectStore(OBJECT_STORE_NAME, {
    keyPath: "head",
  });
  console.log("Creating object store:", FLATTENED_OBJECT_STORE_NAME);
  const flattenedObjectStore: IDBObjectStore = db.createObjectStore(
    FLATTENED_OBJECT_STORE_NAME,
    {
      keyPath: "word",
    },
  );

  console.log("Creating index on 'stem' field");
  flattenedObjectStore.createIndex("stem", "stem", { unique: false });
  console.log("Database schema initialization completed");
}

/**
 * Async data population — runs AFTER the DB has opened successfully.
 * Safe to fetch, decompress, and write data here.
 */
async function populateDB(db: IDBDatabase) {
  console.log("Starting to populate database with dictionary data");
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
    console.log("Database population completed successfully");
  } catch (e) {
    console.error("Error during database population:", e);
  }
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
  console.log("Processing select heads:", data);

  for (const entry of data) {
    const heads = entry.heads ?? [];
    if (heads.length === 0) continue;

    heads.sort(
      (a, b) => Number(a[1]) - Number(b[1]) || Number(a[2]) - Number(b[2]),
    );

    const temp: MeaningResult = {
      word: entry.word,
      meanings: [],
    };

    const selectedHeads = heads.slice(0, MAX_LEN_IN_RESULT_SET);

    for (const head of selectedHeads) {
      const searchHead = head[0];
      const wordIndex = Math.max(Number(head[2]), 0);
      const meaningIndex = Math.max(Number(head[1]), 0);
      const wordPos = head[3];

      const headData = await getHead(searchHead);
      if (!headData) continue;

      const filteredSenses =
        wordPos === "h"
          ? headData.senses
          : headData.senses.filter((sense) => sense.pos === wordPos);

      for (const sense of filteredSenses) {
        const mlRow = Array.isArray(sense.ml?.[meaningIndex])
          ? sense.ml[meaningIndex].flat()
          : [];

        const mlBlock = wordIndex > 0 ? mlRow.slice(wordIndex) : mlRow;

        if (mlBlock.length === 0) continue;

        temp.meanings.push({
          pos: sense.pos,
          ml: mlBlock,
        });
      }

      if (wordPos === "h" && temp.meanings.length > 0) break;
    }

    if (temp.meanings.length > 0) {
      result.push(temp);
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
  (request: { action: string; word: string }, sender, sendResponse) => {
    if (request.action === "getMeaning") {
      (async () => {
        const res: MeaningResult[] = await queryDictionary(request.word);
        sendResponse(res);
      })();
      return true; // Indicates that the response will be sent asynchronously
    }
    {
      return false; // Unrecognized action
    }
  },
);

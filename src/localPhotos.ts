const DATABASE_NAME = "cinematch-local";
const DATABASE_VERSION = 1;
const PHOTO_STORE = "profile-photos";

type StoredPhoto = {
  uid: string;
  dataUrl: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(PHOTO_STORE)) {
        request.result.createObjectStore(PHOTO_STORE, { keyPath: "uid" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("La base locale des photos est inaccessible.")));
    request.addEventListener("blocked", () => reject(new Error("La base locale des photos est bloquée par un autre onglet.")));
  });
}

export async function saveProfilePhoto(uid: string, dataUrl: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PHOTO_STORE, "readwrite");
      transaction.objectStore(PHOTO_STORE).put({ uid, dataUrl } satisfies StoredPhoto);
      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("error", () => reject(transaction.error ?? new Error("L’enregistrement de la photo a échoué.")));
      transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("L’enregistrement de la photo a été interrompu.")));
    });
  } finally {
    database.close();
  }
}

export async function loadProfilePhoto(uid: string): Promise<string | null> {
  const database = await openDatabase();
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const request = database.transaction(PHOTO_STORE, "readonly").objectStore(PHOTO_STORE).get(uid);
      request.addEventListener("success", () => {
        const result: unknown = request.result;
        if (typeof result === "object" && result !== null && "dataUrl" in result && typeof result.dataUrl === "string") {
          resolve(result.dataUrl);
        } else {
          resolve(null);
        }
      });
      request.addEventListener("error", () => reject(request.error ?? new Error("La lecture de la photo a échoué.")));
    });
  } finally {
    database.close();
  }
}

export async function removeProfilePhoto(uid: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PHOTO_STORE, "readwrite");
      transaction.objectStore(PHOTO_STORE).delete(uid);
      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("error", () => reject(transaction.error ?? new Error("La suppression de la photo a échoué.")));
      transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("La suppression de la photo a été interrompue.")));
    });
  } finally {
    database.close();
  }
}

import { createTestDatabase } from "../../../data/db/testDatabase";
import { unwrap } from "../../../domain/ledger/testFixtures";
import { pruneCoverPhotos, saveCoverPhoto } from "./coverPhotos";
import {
  changeLedgerCover,
  createLedger,
  deleteLedger,
  type LedgerCommandDeps,
} from "./ledgerCommands";
import { createMemoryCoverPhotoStore } from "./memoryCoverPhotoStore";

async function setup() {
  const db = await createTestDatabase();
  let seq = 0;
  const deps: LedgerCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => new Date(Date.UTC(2026, 10, 3)),
  };
  return { db, deps, store: createMemoryCoverPhotoStore() };
}

describe("cover photos", () => {
  it("saves a picked photo under a new name for the cover", async () => {
    const { deps, store } = await setup();
    const name = await saveCoverPhoto(store, deps.newId, "cache://picked.jpg");
    expect(name).toBe("id-1.jpg");
    expect(store.files.get(name)).toBe("from:cache://picked.jpg");
  });

  it("keeps photos in use and removes the rest", async () => {
    const { db, deps, store } = await setup();
    const { ledger } = unwrap(
      await createLedger(deps, { name: "京都", memberNames: ["我"] }),
    );
    const kept = await saveCoverPhoto(store, deps.newId, "cache://a.jpg");
    const replaced = await saveCoverPhoto(store, deps.newId, "cache://b.jpg");
    unwrap(
      await changeLedgerCover(deps, ledger.id, {
        style: "photo",
        palette: "ai",
        pattern: "dots",
        photo: kept,
      }),
    );

    expect(await pruneCoverPhotos(db, store)).toBe(1);
    expect([...store.files.keys()]).toEqual([kept]);
    expect(replaced).not.toBe(kept);

    unwrap(await deleteLedger(deps, ledger.id));
    expect(await pruneCoverPhotos(db, store)).toBe(1);
    expect(store.files.size).toBe(0);
  });
});

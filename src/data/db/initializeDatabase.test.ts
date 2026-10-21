import { initializeDatabase } from "./initializeDatabase";
import { MIGRATIONS } from "./migrations";
import { openInMemoryDatabase } from "./testDatabase";

async function userVersion(db: ReturnType<typeof openInMemoryDatabase>) {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  return row?.user_version;
}

describe("initializeDatabase", () => {
  it("applies all migrations to a new database", async () => {
    const db = openInMemoryDatabase();
    await initializeDatabase(db);

    expect(await userVersion(db)).toBe(MIGRATIONS.length);
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual([
      "bot_quotes",
      "expenses",
      "ledgers",
      "members",
      "settlements",
    ]);
  });

  it("enables foreign keys on every open", async () => {
    const db = openInMemoryDatabase();
    await initializeDatabase(db);
    const row = await db.getFirstAsync<{ foreign_keys: number }>(
      "PRAGMA foreign_keys",
    );
    expect(row?.foreign_keys).toBe(1);
  });

  it("is a no-op when the database is already up to date", async () => {
    const db = openInMemoryDatabase();
    await initializeDatabase(db);
    await expect(initializeDatabase(db)).resolves.toBeUndefined();
    expect(await userVersion(db)).toBe(MIGRATIONS.length);
  });

  it("only runs migrations newer than the stored version", async () => {
    const db = openInMemoryDatabase();
    const migrations = [
      { version: 1, sql: "CREATE TABLE a (x)" },
      { version: 2, sql: "CREATE TABLE b (x)" },
    ];
    await initializeDatabase(db, migrations.slice(0, 1));
    await initializeDatabase(db, migrations);
    expect(await userVersion(db)).toBe(2);
  });

  it("rolls back a failing migration and keeps the previous version", async () => {
    const db = openInMemoryDatabase();
    const migrations = [
      { version: 1, sql: "CREATE TABLE a (x)" },
      { version: 2, sql: "CREATE TABLE b (x); INSERT INTO missing VALUES (1)" },
    ];
    await expect(initializeDatabase(db, migrations)).rejects.toThrow();

    expect(await userVersion(db)).toBe(1);
    const b = await db.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE name = 'b'",
    );
    expect(b).toBeUndefined();
  });

  it("refuses a database created by a newer app version", async () => {
    const db = openInMemoryDatabase();
    await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
    await expect(initializeDatabase(db)).rejects.toThrow(/newer/);
  });

  it("rejects non-contiguous migration versions", async () => {
    const db = openInMemoryDatabase();
    await expect(
      initializeDatabase(db, [{ version: 2, sql: "SELECT 1" }]),
    ).rejects.toThrow(/contiguous/);
  });
});

describe("migration 002 (personal ledger)", () => {
  it("defaults existing ledgers to shared and members to not-self", async () => {
    const db = openInMemoryDatabase();
    await initializeDatabase(db, MIGRATIONS.slice(0, 1));
    await db.execAsync(`
      INSERT INTO ledgers (id, name, base_currency, created_at, updated_at)
        VALUES ('l1', '舊帳本', 'TWD', 't', 't');
      INSERT INTO members (id, ledger_id, name, sort_order, created_at)
        VALUES ('m1', 'l1', 'Alice', 0, 't');
    `);

    await initializeDatabase(db);

    expect(
      await db.getFirstAsync("SELECT kind FROM ledgers WHERE id = 'l1'"),
    ).toEqual({ kind: "shared" });
    expect(
      await db.getFirstAsync("SELECT is_self FROM members WHERE id = 'm1'"),
    ).toEqual({ is_self: 0 });
  });
});

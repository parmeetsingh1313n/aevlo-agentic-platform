import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";
import { loadModule } from "./helpers/load-ts-module.mjs";

test("agent persistence enforces ownership and replay safety without changing existing profiles", {
  skip: process.env.AEVLO_DATABASE_TEST !== "1" && "Set AEVLO_DATABASE_TEST=1 to verify the configured database.",
}, async (t) => {
  const { default: nextEnvironment } = await import("@next/env");
  nextEnvironment.loadEnvConfig(process.cwd(), true);
  assert.ok(process.env.DATABASE_URL, "Configure DATABASE_URL before the database check.");

  const { db, agentConfig, users } = loadModule("db/index.ts");
  const { createAgent, getAgentForUser, listAgentsForUser, updateAgentForUser } = loadModule("db/agents.ts");
  const { AgentConflictError, AgentNotFoundError, AgentUpdateConflictError, isAgentVersion } = loadModule("lib/agent-validation.ts");
  const { getAgentAvatarUrl } = loadModule("lib/workspace-ui.ts");
  t.after(() => db.$client.end({ timeout: 3 }));

  const runId = randomUUID();
  const ownerEmail = `agent-owner-${runId}@example.invalid`;
  const otherEmail = `agent-other-${runId}@example.invalid`;
  const legacyEmail = `agent-legacy-${runId}@example.invalid`;
  const fixtureEmails = [ownerEmail, otherEmail, legacyEmail];
  const agentIds = Array.from({ length: 5 }, () => randomUUID());
  const rollback = new Error("Roll back all temporary agent and profile fixtures.");
  const input = (agentId, name) => ({
    agentId,
    name,
    description: "Use the saved instructions.",
    agentImage: getAgentAvatarUrl(agentId),
  });
  const snapshot = (agent) => ({ name: agent.name, description: agent.description, agentImage: agent.agentImage });

  // Every write belongs to this outer transaction. An assertion failure also
  // rejects it, so temporary users and agents are never committed.
  await assert.rejects(db.transaction(async (transaction) => {
    const [profile] = await transaction.insert(users).values({
      email: ownerEmail,
      name: "Saved Profile",
      credits: 2,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
    }).returning();

    const firstInput = input(agentIds[0], "First Agent");
    const first = await createAgent(firstInput, {
      email: ` ${ownerEmail.toUpperCase()} `,
      name: "Replacement Profile Name",
    }, transaction);
    assert.equal(first.created, true);
    assert.equal(first.agent.agentId, firstInput.agentId);
    assert.equal(first.agent.userEmail, ownerEmail);
    assert.equal(first.agent.name, firstInput.name);
    assert.ok(first.agent.createdAt instanceof Date, "The database must assign an agent creation timestamp.");
    assert.equal(isAgentVersion(first.agent.version), true, "Created records expose the current row's opaque xmin text.");

    const replay = await createAgent({ ...firstInput }, { email: ownerEmail, name: null }, transaction);
    assert.equal(replay.created, false);
    assert.equal(replay.agent.id, first.agent.id);
    assert.equal(replay.agent.createdAt.getTime(), first.agent.createdAt.getTime());
    assert.equal(replay.agent.version, first.agent.version);

    for (const changedInput of [
      { ...firstInput, name: "Changed Name" },
      { ...firstInput, description: "Changed instructions." },
      { ...firstInput, agentImage: getAgentAvatarUrl("changed-avatar") },
    ]) {
      await assert.rejects(createAgent(changedInput, { email: ownerEmail }, transaction), AgentConflictError);
    }
    await assert.rejects(createAgent(firstInput, { email: otherEmail }, transaction), AgentConflictError);

    const unchanged = await getAgentForUser(ownerEmail, firstInput.agentId, transaction);
    assert.equal(unchanged.id, first.agent.id);
    assert.equal(unchanged.name, firstInput.name);
    assert.equal(unchanged.description, firstInput.description);
    assert.equal(unchanged.agentImage, firstInput.agentImage);
    assert.equal(unchanged.version, first.agent.version, "Detail reads return the same current version metadata.");
    const duplicates = await transaction.select().from(agentConfig).where(eq(agentConfig.agentId, firstInput.agentId));
    assert.equal(duplicates.length, 1, "Replays and conflicts must not create duplicate agents.");

    const second = await createAgent(input(agentIds[1], "Second Agent"), { email: ownerEmail }, transaction);
    const third = await createAgent(input(agentIds[2], "Third Agent"), { email: ownerEmail }, transaction);
    const other = await createAgent(input(agentIds[3], "Other Owner's Agent"), { email: otherEmail }, transaction);

    const originalSnapshot = snapshot(unchanged);
    const changedInput = {
      ...firstInput,
      agentId: ` ${firstInput.agentId.toUpperCase()} `,
      name: "Updated Agent",
      description: "New saved instructions.",
      agentImage: getAgentAvatarUrl("updated-avatar"),
      expected: originalSnapshot,
      expectedVersion: unchanged.version,
      // Even direct persistence calls must allowlist mutable columns.
      id: other.agent.id,
      userEmail: otherEmail,
      createdAt: new Date("1900-01-01T00:00:00.000Z"),
      version: "spoofed-return-version",
      credits: 999,
    };
    const updated = await updateAgentForUser(changedInput, ` ${ownerEmail.toUpperCase()} `, transaction);
    assert.deepEqual(snapshot(updated), {
      name: changedInput.name,
      description: changedInput.description,
      agentImage: changedInput.agentImage,
    });
    assert.equal(updated.id, first.agent.id);
    assert.equal(updated.agentId, firstInput.agentId);
    assert.equal(updated.userEmail, ownerEmail);
    assert.equal(updated.createdAt.getTime(), first.agent.createdAt.getTime(), "Saving configuration must preserve creation time.");
    assert.equal(isAgentVersion(updated.version), true);
    assert.equal(updated.version, first.agent.version, "All writes in this outer transaction share xmin; separate-autocommit tests verify version changes.");

    const retry = await updateAgentForUser(changedInput, ownerEmail, transaction);
    assert.deepEqual(snapshot(retry), snapshot(updated), "An identical replay must succeed after its initial response is lost.");
    assert.equal(retry.createdAt.getTime(), first.agent.createdAt.getTime());
    assert.equal(retry.version, updated.version);
    await assert.rejects(updateAgentForUser({
      ...changedInput,
      name: "Version-only stale overwrite",
      expected: snapshot(updated),
      expectedVersion: updated.version === "0" ? "1" : "0",
    }, ownerEmail, transaction), AgentUpdateConflictError, "A mismatched version must reject even when every expected editable value matches.");
    const versionReplay = await updateAgentForUser({ ...changedInput, expected: snapshot(updated), expectedVersion: "0" }, ownerEmail, transaction);
    assert.deepEqual(snapshot(versionReplay), snapshot(updated), "An already-saved desired result is a safe replay even with a stale version.");
    assert.equal(versionReplay.version, updated.version, "A replay returns the current persisted token.");
    await assert.rejects(updateAgentForUser({ ...changedInput, name: "Stale overwrite" }, ownerEmail, transaction), AgentUpdateConflictError);
    for (const staleSnapshot of [
      { ...snapshot(updated), name: originalSnapshot.name },
      { ...snapshot(updated), description: null },
      { ...snapshot(updated), agentImage: originalSnapshot.agentImage },
    ]) {
      await assert.rejects(updateAgentForUser({ ...changedInput, name: "Different stale overwrite", expected: staleSnapshot }, ownerEmail, transaction), AgentUpdateConflictError);
    }
    assert.deepEqual(snapshot(await getAgentForUser(ownerEmail, firstInput.agentId, transaction)), snapshot(updated), "Conflicts must leave the newer configuration intact.");
    await assert.rejects(updateAgentForUser(changedInput, otherEmail, transaction), AgentNotFoundError);
    await assert.rejects(updateAgentForUser({ ...changedInput, agentId: randomUUID() }, ownerEmail, transaction), AgentNotFoundError);

    const blankInstructions = await updateAgentForUser({ ...changedInput, description: null, expected: snapshot(updated), expectedVersion: updated.version }, ownerEmail, transaction);
    assert.equal(blankInstructions.description, null);
    const restoredInstructions = await updateAgentForUser({ ...changedInput, description: "Instructions after an empty value.", expected: snapshot(blankInstructions), expectedVersion: blankInstructions.version }, ownerEmail, transaction);
    assert.equal(restoredInstructions.description, "Instructions after an empty value.", "A null expected description must match using SQL IS NULL.");
    assert.equal(restoredInstructions.createdAt.getTime(), first.agent.createdAt.getTime());
    assert.deepEqual(await getAgentForUser(ownerEmail, second.agent.agentId, transaction), second.agent, "Saving one agent must not alter another agent belonging to the owner.");
    assert.deepEqual(await getAgentForUser(otherEmail, other.agent.agentId, transaction), other.agent, "Rejected ownership changes must not alter another user's agent.");
    // PostgreSQL defaultNow() is fixed for an entire transaction. Assign a
    // distinct older time to verify timestamp ordering as well as the id tie.
    await transaction.update(agentConfig).set({ createdAt: new Date("2021-01-01T00:00:00.000Z") })
      .where(eq(agentConfig.agentId, firstInput.agentId));

    const listed = await listAgentsForUser(` ${ownerEmail.toUpperCase()} `, transaction);
    assert.deepEqual(listed.map((agent) => agent.agentId), [third.agent.agentId, second.agent.agentId, first.agent.agentId]);
    assert.ok(listed.every((agent) => agent.userEmail === ownerEmail));
    assert.ok(listed.every((agent) => isAgentVersion(agent.version)), "List responses include opaque version metadata for every record.");
    assert.equal(await getAgentForUser(ownerEmail, other.agent.agentId, transaction), null);
    assert.equal(await getAgentForUser(otherEmail, first.agent.agentId, transaction), null);
    assert.equal(await getAgentForUser(ownerEmail, randomUUID(), transaction), null);
    assert.equal(await getAgentForUser(ownerEmail, "invalid-agent-id", transaction), null);
    const ownDetail = await getAgentForUser(` ${ownerEmail.toUpperCase()} `, third.agent.agentId.toUpperCase(), transaction);
    assert.equal(ownDetail.id, third.agent.id);
    assert.equal(ownDetail.version, third.agent.version);
    const otherList = await listAgentsForUser(otherEmail, transaction);
    assert.deepEqual(otherList.map((agent) => agent.agentId), [other.agent.agentId]);

    const legacyBefore = await transaction.select().from(users).where(eq(users.email, legacyEmail));
    assert.equal(legacyBefore.length, 0);
    const legacy = await createAgent(input(agentIds[4], "Legacy Session Agent"), {
      email: ` ${legacyEmail.toUpperCase()} `,
      name: " Legacy Session Name ",
    }, transaction);
    assert.equal(legacy.created, true);
    assert.equal(legacy.agent.userEmail, legacyEmail);
    assert.equal(isAgentVersion(legacy.agent.version), true);
    const legacyProfiles = await transaction.select().from(users).where(eq(users.email, legacyEmail));
    assert.equal(legacyProfiles.length, 1, "An existing JWT session must be able to satisfy the owner foreign key.");
    assert.equal(legacyProfiles[0].name, "Legacy Session Name");
    assert.equal(legacyProfiles[0].credits, 5);
    assert.ok(legacyProfiles[0].createdAt instanceof Date);

    const [savedProfile] = await transaction.select().from(users).where(eq(users.email, ownerEmail));
    assert.equal(savedProfile.id, profile.id);
    assert.equal(savedProfile.name, "Saved Profile");
    assert.equal(savedProfile.credits, 2, "Creating or replaying an agent must not reset credits.");
    assert.equal(savedProfile.createdAt.getTime(), profile.createdAt.getTime());
    throw rollback;
  }), (error) => error === rollback);

  const remainingUsers = await db.select().from(users).where(inArray(users.email, fixtureEmails));
  const remainingAgents = await db.select().from(agentConfig).where(inArray(agentConfig.agentId, agentIds));
  assert.equal(remainingUsers.length, 0, "The database check must leave no fixture users behind.");
  assert.equal(remainingAgents.length, 0, "The database check must leave no fixture agents behind.");
});

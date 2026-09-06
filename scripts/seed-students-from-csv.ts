import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { eq, inArray } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

import {
  academicGroups, departments, hostels, parents, roles, students, userRoles, users,
} from "@/db";
import { ROLES } from "@/lib/auth/roles";
import { db } from "@/lib/db";

/**
 * Seeds students, users, parents, and academic groups from the CSV roster.
 * Idempotent; skips Aadhar/photos; bulk-inserted for speed.
 */

type RosterRow = {
  name: string;
  email: string;
  program: string;
  programName: string;
  section: string | null;
  file: string;
};
type PersonalRow = Record<string, string>;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const clean = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); field = ""; rows.push(row); row = []; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}
function asRecords(rows: string[][]): Array<Record<string, string>> {
  const head = rows[0]!;
  return rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    head.forEach((h, i) => { rec[h] = (r[i] ?? "").trim(); });
    return rec;
  });
}
function deriveRollNumber(email: string): string | null {
  const segments = email.toLowerCase().split("@")[0]!.split(".");
  for (let i = segments.length - 1; i >= 0; i--) {
    const m = segments[i]!.match(/^(\d{2})([a-z]+)(\d+)$/);
    if (m) return `${m[1]}${m[2]}${m[3]}`.toUpperCase();
  }
  return null;
}
function joinYear(roll: string): number | null {
  const m = roll.match(/^(\d{2})[A-Z]+\d+$/);
  if (!m) return null;
  const y = 2000 + Number(m[1]);
  return y >= 2020 && y <= 2035 ? y : null;
}
function normPhone(raw: string): string | null {
  let d = raw.replace(/[^\d]/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10 ? d : null;
}
function cleanEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v || v === "--" || v === "-" || /^n\/?a$/i.test(v)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}
function cleanName(raw: string): string | null {
  const v = raw.trim().replace(/\s+/g, " ");
  if (!v || /^n\/?a$/i.test(v)) return null;
  return v;
}
function parseDob(raw: string): string | null {
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

async function main() {
  const dataDir = path.resolve(process.cwd(), "data");

  // ── Roster ──
  const roster = new Map<string, RosterRow>();
  const skipped = new Map<string, number>();
  const skip = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  for (const file of fs.readdirSync(dataDir).filter((f) => f.startsWith("batch")).sort()) {
    const recs = asRecords(parseCsv(fs.readFileSync(path.join(dataDir, file), "utf8")));
    const secFromFile = /section-([A-Za-z])\.csv$/i.exec(file)?.[1]?.toUpperCase() ?? null;
    for (const r of recs) {
      const email = (r.email ?? "").trim().toLowerCase();
      const status = (r.enrollment_status ?? "").trim().toLowerCase();
      if (!email) { skip("roster: blank email"); continue; }
      if (status !== "active") { skip(`roster: status=${status || "(blank)"}`); continue; }
      if (roster.has(email)) { skip("roster: duplicate email"); continue; }
      roster.set(email, { name: (r.name ?? "").trim(), email, program: (r.program ?? "").trim(), programName: (r.program_name ?? "").trim(), section: (r.section ?? "").trim() || secFromFile, file });
    }
  }

  // ── Personal enrichment ──
  const personalFile = fs.readdirSync(dataDir).find((f) => f.toLowerCase().startsWith("student personal detail"));
  if (!personalFile) throw new Error("Personal detail CSV not found in data/");
  const personalRows = asRecords(parseCsv(fs.readFileSync(path.join(dataDir, personalFile), "utf8")));
  const personal = new Map<string, PersonalRow>();
  for (const r of personalRows) {
    const e = (r["Email Address"] ?? "").trim().toLowerCase();
    if (e && !personal.has(e)) personal.set(e, r);
  }

  // ── Reference data ──
  const hostelRows = await db.select({ id: hostels.id, code: hostels.code }).from(hostels);
  const hostelByCode = new Map(hostelRows.map((h) => [h.code, h.id]));
  if (!hostelByCode.has("UNI-1") || !hostelByCode.has("UNI-2")) throw new Error("Hostels UNI-1/UNI-2 missing.");

  const deptRows = await db.select({ id: departments.id, code: departments.code }).from(departments);
  const deptByCode = new Map(deptRows.map((d) => [d.code, d.id]));

  // Pre-load existing users by email to match across runs and avoid FK violations
  const existingUsers = await db.select({ id: users.id, email: users.email, phone: users.phone, fullName: users.fullName, hostelId: users.hostelId, gender: users.gender, isActive: users.isActive }).from(users);
  const userByEmail = new Map(existingUsers.map((u) => [u.email!.toLowerCase(), u]));
  // users.phone is unique: track which email holds each phone so a genuine
  // duplicate never aborts a bulk insert (a user's own phone is kept)
  const phoneOwner = new Map(
    existingUsers
      .filter((u) => u.phone && u.email)
      .map((u) => [u.phone as string, u.email!.toLowerCase()]),
  );

  const roleRows = await db.select({ id: roles.id, code: roles.code }).from(roles);
  const studentRoleId = roleRows.find((r) => r.code === ROLES.STUDENT)?.id;
  if (!studentRoleId) throw new Error("STUDENT role missing.");

  // Preload academic groups from DB
  const existingGroups = await db.select({ id: academicGroups.id, batchYear: academicGroups.batchYear, groupCode: academicGroups.groupCode, departmentId: academicGroups.departmentId }).from(academicGroups);
  const groupCache = new Map<string, string>();
  for (const g of existingGroups) {
    const key = `${g.departmentId}|${g.batchYear}|${g.groupCode ?? ""}`;
    groupCache.set(key, g.id);
  }

  // Preload existing students by roll number (single query — not per roster row)
  const existingStudentRows = await db.select({ id: students.id, rollNumber: students.rollNumber }).from(students);
  const studentByRoll = new Map(existingStudentRows.map((s) => [s.rollNumber, s.id]));

  // Preload existing parents keyed by (rollNumber, phone) to avoid duplicates
  const existingParentRows = await db
    .select({ rollNumber: students.rollNumber, phone: parents.phone })
    .from(parents)
    .innerJoin(students, eq(parents.studentId, students.id));
  const parentByKey = new Set(existingParentRows.map((p) => `${p.rollNumber}|${p.phone}`));

  // Track which users already have STUDENT role (avoids per-row SELECT)
  const existingUserRoleRows = await db.select({ userId: userRoles.userId }).from(userRoles).where(inArray(userRoles.roleId, [studentRoleId]));
  const usersWithStudentRole = new Set(existingUserRoleRows.map((r) => r.userId));

  const hostelFor = (raw: string): string | null => {
    if (/uniworld\s*1/i.test(raw)) return hostelByCode.get("UNI-1")!;
    if (/uniworld\s*2/i.test(raw)) return hostelByCode.get("UNI-2")!;
    return null;
  };

  // ── Build batches ──
  const usersToInsert: Array<{ fullName: string; email: string; phone: string | null; hostelId: string | null; gender: "MALE" | "FEMALE" | null; isActive: boolean }> = [];
  const usersToUpdate: Array<{ id: string; fullName: string; hostelId: string | null; gender: "MALE" | "FEMALE" | null; isActive: boolean; phone: string | null }> = [];
  const studentInserts: Array<{ userId: string; academicGroupId: string; rollNumber: string; roomNumber: string | null; currentLocationState: string; metadata: object }> = [];
  const studentUpdates: Array<{ id: string; roomNumber: string | null; metadata: object }> = [];
  const parentInserts: Array<{ studentId: string; name: string; phone: string; email: string | null; relationship: string; isPrimary: boolean }> = [];
  const parentCandidates = new Map<string, Array<{ name: string; phone: string; email: string | null; relationship: string; isPrimary: boolean }>>();
  const roleInserts: Array<{ userId: string; roleId: string }> = [];

  const personalOnly: string[] = [];
  let usersReused = 0;
  let phonesNulled = 0;

  for (const item of roster.values()) {
    const rollNumber = deriveRollNumber(item.email);
    if (!rollNumber) { skip("roster: email has no roll pattern"); continue; }
    const batchYear = joinYear(rollNumber);
    if (!batchYear) { skip("roster: roll year out of range"); continue; }
    if (!deptByCode.has(item.program)) { skip(`roster: unknown program=${item.program || "(blank)"}`); continue; }

    const p = personal.get(item.email);
    const personalStatus = (p?.["Current Status"] ?? "").trim().toLowerCase();
    if (p && personalStatus === "left college") { skip("personal: Left College"); continue; }

    const fullName = cleanName(p?.["Full Name (As Per Aadhar)"] ?? "") ?? cleanName(item.name) ?? item.email;
    const genderRaw = (p?.Gender ?? "").trim().toLowerCase();
    const gender = genderRaw === "male" ? "MALE" : genderRaw === "female" ? "FEMALE" : null;
    const hostelId = p ? hostelFor(p["My Hostel:"] ?? "") : null;
    const roomNumber = (p?.["Room Number"] ?? "").trim() || null;

    let phone = p ? normPhone(p["Personal Mobile Number"] ?? "") : null;
    if (phone) {
      const owner = phoneOwner.get(phone);
      if (owner !== undefined && owner !== item.email) {
        phone = null;
        phonesNulled++;
      } else {
        phoneOwner.set(phone, item.email);
      }
    }

    const deptId = deptByCode.get(item.program)!;
    const groupKey = `${deptId}|${batchYear}|${item.section ?? ""}`;
    if (!groupCache.has(groupKey)) {
      const candidates = existingGroups.filter((g) => g.departmentId === deptId && g.batchYear === batchYear && (g.groupCode ?? null) === (item.section ?? null));
      if (candidates.length > 0) groupCache.set(groupKey, candidates[0]!.id);
    }
    let groupId = groupCache.get(groupKey);
    if (!groupId) {
      const [created] = await db.insert(academicGroups).values({ departmentId: deptId, batchYear, groupCode: item.section ?? null, name: `${item.program} ${batchYear}${item.section ? ` ${item.section}` : ""}`, isActive: true }).onConflictDoNothing().returning({ id: academicGroups.id });
      if (created) { groupId = created.id; groupCache.set(groupKey, created.id); }
      else { const retry = await db.select({ id: academicGroups.id, batchYear: academicGroups.batchYear, groupCode: academicGroups.groupCode }).from(academicGroups).where(eq(academicGroups.departmentId, deptId)).limit(100); const hit = retry.find((g) => g.batchYear === batchYear && (g.groupCode ?? null) === (item.section ?? null)); if (!hit) throw new Error(`Academic group missing for ${groupKey}`); groupId = hit.id; groupCache.set(groupKey, hit.id); }
    }

    const existingUser = userByEmail.get(item.email);
    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      usersReused++;
      const needsUpdate =
        existingUser.fullName !== fullName ||
        (existingUser.hostelId ?? null) !== (hostelId ?? null) ||
        (existingUser.gender ?? null) !== gender ||
        existingUser.isActive !== true ||
        (phone !== null && existingUser.phone !== phone);
      if (needsUpdate) {
        usersToUpdate.push({ id: userId, fullName, hostelId, gender: gender as "MALE" | "FEMALE" | null, isActive: true, phone });
      }
    } else {
      userId = crypto.randomUUID();
      usersToInsert.push({ fullName, email: item.email, phone, hostelId, gender: gender as "MALE" | "FEMALE" | null, isActive: true });
      userByEmail.set(item.email, { id: userId, email: item.email, phone, fullName, hostelId, gender: gender as "MALE" | "FEMALE" | "OTHER" | null, isActive: true });
    }

    if (!usersWithStudentRole.has(userId)) {
      roleInserts.push({ userId, roleId: studentRoleId });
      usersWithStudentRole.add(userId);
    }

    const dob = p ? parseDob(p["Date of Birth"] ?? "") : null;
    const metadata: Record<string, unknown> = { program: item.program, ...(item.programName ? { programName: item.programName } : {}), ...(item.section ? { section: item.section } : {}), batchYear, ...(p?.Batch ? { gradBatch: p.Batch.trim() } : {}), ...(dob ? { dob } : {}), ...(p?.["Blood Group"] ? { bloodGroup: p["Blood Group"].trim() } : {}), ...(p?.["Food Preference"] ? { foodPreference: p["Food Preference"].trim() } : {}), ...(p?.Hometown ? { hometown: p.Hometown.trim() } : {}), ...(p?.State ? { state: p.State.trim() } : {}) };

    if (studentByRoll.has(rollNumber)) {
      studentUpdates.push({ id: studentByRoll.get(rollNumber)!, roomNumber, metadata });
    } else {
      studentInserts.push({ userId, academicGroupId: groupId, rollNumber, roomNumber, currentLocationState: "IN_HOSTEL", metadata });
    }

    if (p) {
      const cands = [
        { name: cleanName(p["Father's Name"] ?? ""), phone: normPhone(p["Father's Contact Number"] ?? ""), email: cleanEmail(p["Father's Email ID"] ?? ""), relationship: "Father" },
        { name: cleanName(p["Mother's Name"] ?? ""), phone: normPhone(p["Mother's Contact Number"] ?? ""), email: cleanEmail(p["Mother's Email ID"] ?? ""), relationship: "Mother" },
      ].filter((c) => c.name && c.phone);
      // Resolved to the student's uuid only after students are inserted (below)
      let primaryAssigned = false;
      for (const c of cands) {
        const list = parentCandidates.get(rollNumber) ?? [];
        list.push({ name: c.name!, phone: c.phone!, email: c.email, relationship: c.relationship, isPrimary: !primaryAssigned });
        parentCandidates.set(rollNumber, list);
        primaryAssigned = true;
      }
    }
  }

  // Personal-only active emails not in roster
  for (const [email, prow] of personal) {
    const st = (prow["Current Status"] ?? "").trim().toLowerCase();
    if (!roster.has(email) && (st === "active" || st === "")) personalOnly.push(email);
  }

  // ── Bulk execute ──
  const counts = { usersInserted: 0, usersUpdated: 0, studentsInserted: 0, studentsUpdated: 0, parentsInserted: 0, rolesInserted: 0, phonesNulled };

  if (usersToInsert.length > 0) {
    const result = await db.insert(users).values(usersToInsert).onConflictDoNothing({ target: users.email }).returning({ id: users.id });
    counts.usersInserted = result.length;
  }
  if (usersToUpdate.length > 0) {
    for (let i = 0; i < usersToUpdate.length; i += 500) {
      const batch = usersToUpdate.slice(i, i + 500);
      for (const u of batch) {
        await db.update(users).set({ fullName: u.fullName, hostelId: u.hostelId, gender: u.gender, isActive: u.isActive, ...(u.phone !== null ? { phone: u.phone } : {}) }).where(eq(users.id, u.id));
      }
    }
    counts.usersUpdated = usersToUpdate.length;
  }
  if (studentInserts.length > 0) {
    const result = await db.insert(students).values(studentInserts).onConflictDoNothing({ target: students.rollNumber }).returning({ id: students.id, rollNumber: students.rollNumber });
    counts.studentsInserted = result.length;
    for (const s of result) studentByRoll.set(s.rollNumber, s.id);
  }
  if (studentUpdates.length > 0) {
    for (let i = 0; i < studentUpdates.length; i += 500) {
      const batch = studentUpdates.slice(i, i + 500);
      for (const s of batch) {
        await db.update(students).set({ roomNumber: s.roomNumber, metadata: s.metadata as never }).where(eq(students.id, s.id));
      }
    }
    counts.studentsUpdated = studentUpdates.length;
  }
  // Resolve roll numbers to student uuids now that inserts are in place, then insert
  for (const [rollNumber, cands] of parentCandidates) {
    const studentId = studentByRoll.get(rollNumber);
    if (!studentId) {
      skip(`parent: no student row for roll ${rollNumber}`);
      continue;
    }
    for (const c of cands) {
      const key = `${rollNumber}|${c.phone}`;
      if (parentByKey.has(key)) continue;
      parentInserts.push({ studentId, name: c.name, phone: c.phone, email: c.email, relationship: c.relationship, isPrimary: c.isPrimary });
      parentByKey.add(key);
    }
  }
  if (parentInserts.length > 0) {
    for (let i = 0; i < parentInserts.length; i += 500) {
      const batch = parentInserts.slice(i, i + 500);
      const result = await db.insert(parents).values(batch).onConflictDoNothing({ target: [parents.studentId, parents.phone] }).returning({ id: parents.id });
      counts.parentsInserted += result.length;
    }
  }
  if (roleInserts.length > 0) {
    for (let i = 0; i < roleInserts.length; i += 500) {
      const batch = roleInserts.slice(i, i + 500);
      await db.insert(userRoles).values(batch.map((r) => ({ userId: r.userId, roleId: r.roleId, scopeType: null as string | null, scopeId: null as string | null, assignedBy: null as string | null }))).onConflictDoNothing();
    }
    counts.rolesInserted = roleInserts.length;
  }

  console.log("\nDone.");
  console.log(`  users inserted: ${counts.usersInserted}, reused: ${usersReused}, updated: ${counts.usersUpdated}`);
  console.log(`  students inserted: ${counts.studentsInserted}, updated: ${counts.studentsUpdated}`);
  console.log(`  parents inserted: ${counts.parentsInserted}`);
  console.log(`  roles inserted: ${counts.rolesInserted}`);
  console.log("  skipped:", JSON.stringify([...skipped], null, 2));
  console.log(`  personal-only active emails skipped: ${personalOnly.length}`);
  if (personalOnly.length > 0) console.log(`    e.g. ${personalOnly.slice(0, 10).join(", ")}`);
}

main().then(() => process.exit(0)).catch((error) => { console.error("\nFailed:", error); process.exit(1); });
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.production") });

import { eq } from "drizzle-orm";
import * as fs from "fs";

import {
  academicGroups,
  hostels,
  parents,
  roles,
  students,
  userRoles,
  users,
} from "@/db";
import { db } from "@/lib/db";

const csvPath = "C:\\Users\\Veda\\Downloads\\Students' Personal Detail _ 2026 - Form Responses 1.csv";

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
    else if (c === "\r") { }
    else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
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
  if (!raw) return null;
  let d = raw.replace(/[^\d]/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10 ? d : null;
}

function cleanEmail(raw: string): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v || v === "--" || v === "-" || /^n\/?a$/i.test(v)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

function cleanName(raw: string): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/\s+/g, " ");
  if (!v || /^n\/?a$/i.test(v)) return null;
  return v;
}

function parseDob(raw: string): string | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function cleanRoom(raw: string): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || /^#n\/?a$/i.test(v) || v === "-" || /^none$/i.test(v)) return null;
  return v;
}

async function runProductionSync() {
  console.log("=== COMMITTING CSV STUDENT & PARENT SYNC TO PRODUCTION DATABASE ===");

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(content);
  const head = rows[0]!;
  const records = rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    head.forEach((h, i) => { rec[h] = (r[i] ?? "").trim(); });
    return rec;
  });

  const latestByEmail = new Map<string, Record<string, string>>();
  for (const r of records) {
    const email = (r["Email Address"] ?? "").trim().toLowerCase();
    if (!email) continue;
    const existing = latestByEmail.get(email);
    if (!existing || Date.parse(r["Timestamp"] || "") > Date.parse(existing["Timestamp"] || "")) {
      latestByEmail.set(email, r);
    }
  }

  console.log(`Unique student email entries from CSV: ${latestByEmail.size}`);

  await db.transaction(async (tx) => {
    // 1. Reference data
    const dbHostels = await tx.select().from(hostels);
    const hostelByCode = new Map(dbHostels.map((h) => [h.code, h.id]));
    const hostelFor = (raw: string): string | null => {
      if (/uniworld\s*1/i.test(raw)) return hostelByCode.get("UNI-1")!;
      if (/uniworld\s*2/i.test(raw)) return hostelByCode.get("UNI-2")!;
      return null;
    };

    const dbGroups = await tx.select().from(academicGroups);
    const groupByKey = new Map<string, string>();
    for (const g of dbGroups) {
      groupByKey.set(`${g.batchYear}|${g.groupCode ?? "UNASSIGNED"}`, g.id);
    }

    const dbRoles = await tx.select().from(roles);
    const studentRole = dbRoles.find((r) => r.code === "STUDENT")!;

    const dbUsers = await tx.select().from(users);
    const userByEmail = new Map(dbUsers.map((u) => [u.email?.toLowerCase() ?? "", u]));
    const userById = new Map(dbUsers.map((u) => [u.id, u]));
    const userByPhone = new Map<string, typeof dbUsers[0]>();
    for (const u of dbUsers) {
      if (u.phone) userByPhone.set(u.phone, u);
    }

    const dbUserRoles = await tx.select().from(userRoles);
    const userRolesSet = new Set(dbUserRoles.map((ur) => `${ur.userId}|${ur.roleId}`));

    const dbStudents = await tx.select().from(students);
    const studentByRoll = new Map(dbStudents.map((s) => [s.rollNumber.toUpperCase(), s]));

    const dbParents = await tx.select().from(parents);
    const parentsByStudentId = new Map<string, typeof dbParents>();
    for (const p of dbParents) {
      if (!parentsByStudentId.has(p.studentId)) parentsByStudentId.set(p.studentId, []);
      parentsByStudentId.get(p.studentId)!.push(p);
    }

    const parentPhonesByStudent = new Map<string, Set<string>>();
    const hasPrimaryByStudent = new Map<string, boolean>();
    for (const [sId, pList] of parentsByStudentId) {
      parentPhonesByStudent.set(sId, new Set(pList.map((p) => p.phone)));
      hasPrimaryByStudent.set(sId, pList.some((p) => p.isPrimary));
    }

    let usersInserted = 0;
    let usersUpdated = 0;
    let rolesAssigned = 0;
    let studentsInserted = 0;
    let studentsUpdated = 0;
    let parentsInserted = 0;
    let parentsUpdated = 0;

    for (const [email, r] of latestByEmail) {
      const roll = deriveRollNumber(email);
      if (!roll) continue;
      const batchYear = joinYear(roll);
      if (!batchYear) continue;

      const name = cleanName(r["Full Name (As Per Aadhar)"]) || email;
      const genderRaw = (r["Gender"] ?? "").trim().toLowerCase();
      const gender = genderRaw === "male" ? "MALE" : genderRaw === "female" ? "FEMALE" : null;
      const hostelId = hostelFor(r["My Hostel:"] ?? "");
      const roomNumber = cleanRoom(r["Room Number"] ?? "");
      const currentStatus = (r["Current Status"] ?? "").trim();
      const isActive = currentStatus !== "Left College";

      let phone = normPhone(r["Personal Mobile Number"] ?? "");
      if (phone) {
        const owner = userByPhone.get(phone);
        if (owner && owner.email?.toLowerCase() !== email) {
          phone = null;
        }
      }

      const dob = parseDob(r["Date of Birth"] ?? "");
      const metadataUpdate = {
        ...(r.Batch ? { gradBatch: r.Batch.trim() } : {}),
        ...(dob ? { dob } : {}),
        ...(r["Blood Group"] ? { bloodGroup: r["Blood Group"].trim() } : {}),
        ...(r["Food Preference"] ? { foodPreference: r["Food Preference"].trim() } : {}),
        ...(r.Hometown ? { hometown: r.Hometown.trim() } : {}),
        ...(r.State ? { state: r.State.trim() } : {}),
        ...(currentStatus ? { currentStatus } : {}),
      };

      const existingStudent = studentByRoll.get(roll);

      if (!existingStudent) {
        // Missing student
        let userId: string;
        const existingUser = userByEmail.get(email);

        if (existingUser) {
          userId = existingUser.id;
          await tx.update(users).set({
            fullName: name,
            phone: phone ?? existingUser.phone,
            gender: gender ?? existingUser.gender,
            hostelId: hostelId ?? existingUser.hostelId,
            isActive,
            updatedAt: new Date(),
          }).where(eq(users.id, userId));
          usersUpdated++;
        } else {
          const [createdUser] = await tx.insert(users).values({
            email,
            fullName: name,
            phone,
            gender,
            hostelId,
            isActive,
          }).returning({ id: users.id });
          userId = createdUser!.id;
          usersInserted++;
          userByEmail.set(email, { id: userId, email, phone, fullName: name, hostelId, gender, isActive } as any);
        }

        if (!userRolesSet.has(`${userId}|${studentRole.id}`)) {
          await tx.insert(userRoles).values({
            userId,
            roleId: studentRole.id,
          });
          userRolesSet.add(`${userId}|${studentRole.id}`);
          rolesAssigned++;
        }

        const agId = groupByKey.get(`${batchYear}|UNASSIGNED`) ?? groupByKey.get(`2026|UNASSIGNED`)!;
        const [createdStudent] = await tx.insert(students).values({
          userId,
          academicGroupId: agId,
          roomNumber,
          rollNumber: roll,
          currentLocationState: "IN_HOSTEL",
          metadata: {
            program: "CS-AI",
            batchYear,
            ...metadataUpdate,
          },
        }).returning({ id: students.id });
        const studentId = createdStudent!.id;
        studentsInserted++;
        studentByRoll.set(roll, { id: studentId, userId, academicGroupId: agId, roomNumber, rollNumber: roll, currentLocationState: "IN_HOSTEL", metadata: metadataUpdate } as any);

        // Parents for new student
        const fName = cleanName(r["Father's Name"]);
        const fPhone = normPhone(r["Father's Contact Number"]);
        const fEmail = cleanEmail(r["Father's Email ID"]);

        const mName = cleanName(r["Mother's Name"]);
        const mPhone = normPhone(r["Mother's Contact Number"]);
        const mEmail = cleanEmail(r["Mother's Email ID"]);

        let primaryAssigned = false;
        const sPhones = new Set<string>();

        if (fName && fPhone) {
          await tx.insert(parents).values({
            studentId,
            name: fName,
            phone: fPhone,
            email: fEmail,
            relationship: "Father",
            isPrimary: true,
          });
          primaryAssigned = true;
          sPhones.add(fPhone);
          parentsInserted++;
        }

        if (mName && mPhone && !sPhones.has(mPhone)) {
          await tx.insert(parents).values({
            studentId,
            name: mName,
            phone: mPhone,
            email: mEmail,
            relationship: "Mother",
            isPrimary: !primaryAssigned,
          });
          sPhones.add(mPhone);
          parentsInserted++;
        }
      } else {
        // Existing student
        const studentId = existingStudent.id;
        const existingUser = userById.get(existingStudent.userId);

        if (existingUser) {
          const nameChanged = name && name !== existingUser.fullName;
          const genderChanged = gender && gender !== existingUser.gender;
          const hostelChanged = hostelId && hostelId !== existingUser.hostelId;
          const phoneChanged = phone && phone !== existingUser.phone;
          const activeChanged = isActive !== existingUser.isActive;

          if (nameChanged || genderChanged || hostelChanged || phoneChanged || activeChanged) {
            await tx.update(users).set({
              fullName: nameChanged ? name : existingUser.fullName,
              gender: genderChanged ? gender : existingUser.gender,
              hostelId: hostelChanged ? hostelId : existingUser.hostelId,
              phone: phoneChanged ? phone : existingUser.phone,
              isActive: activeChanged ? isActive : existingUser.isActive,
              updatedAt: new Date(),
            }).where(eq(users.id, existingUser.id));
            usersUpdated++;
          }
        }

        const roomChanged = roomNumber && roomNumber !== existingStudent.roomNumber;
        const existingMeta = (existingStudent.metadata as Record<string, any>) || {};
        const newMeta = { ...existingMeta, ...metadataUpdate };
        const metaChanged = JSON.stringify(existingMeta) !== JSON.stringify(newMeta);

        if (roomChanged || metaChanged) {
          await tx.update(students).set({
            roomNumber: roomChanged ? roomNumber : existingStudent.roomNumber,
            metadata: newMeta,
            updatedAt: new Date(),
          }).where(eq(students.id, studentId));
          studentsUpdated++;
        }

        // Check parents
        const currParents = parentsByStudentId.get(studentId) ?? [];
        const currFather = currParents.find((p) => p.relationship.toLowerCase() === "father");
        const currMother = currParents.find((p) => p.relationship.toLowerCase() === "mother");
        const sPhones = parentPhonesByStudent.get(studentId) ?? new Set<string>();
        let hasPrimary = hasPrimaryByStudent.get(studentId) ?? false;

        const fName = cleanName(r["Father's Name"]);
        const fPhone = normPhone(r["Father's Contact Number"]);
        const fEmail = cleanEmail(r["Father's Email ID"]);

        const mName = cleanName(r["Mother's Name"]);
        const mPhone = normPhone(r["Mother's Contact Number"]);
        const mEmail = cleanEmail(r["Mother's Email ID"]);

        // Father
        if (fName && fPhone) {
          if (!currFather) {
            if (!sPhones.has(fPhone)) {
              const makePrimary = !hasPrimary;
              await tx.insert(parents).values({
                studentId,
                name: fName,
                phone: fPhone,
                email: fEmail,
                relationship: "Father",
                isPrimary: makePrimary,
              });
              sPhones.add(fPhone);
              if (makePrimary) {
                hasPrimary = true;
                hasPrimaryByStudent.set(studentId, true);
              }
              parentsInserted++;
            }
          } else {
            const nameDiff = fName !== currFather.name;
            const phoneDiff = fPhone !== currFather.phone;
            const emailDiff = fEmail && fEmail !== currFather.email;

            if (nameDiff || phoneDiff || emailDiff) {
              if (phoneDiff && sPhones.has(fPhone)) {
                // Conflict with other parent phone, don't change phone
                if (nameDiff || emailDiff) {
                  await tx.update(parents).set({
                    name: fName,
                    email: fEmail ?? currFather.email,
                    updatedAt: new Date(),
                  }).where(eq(parents.id, currFather.id));
                  parentsUpdated++;
                }
              } else {
                sPhones.delete(currFather.phone);
                sPhones.add(fPhone);
                await tx.update(parents).set({
                  name: fName,
                  phone: fPhone,
                  email: fEmail ?? currFather.email,
                  updatedAt: new Date(),
                }).where(eq(parents.id, currFather.id));
                parentsUpdated++;
              }
            }
          }
        }

        // Mother
        if (mName && mPhone) {
          if (!currMother) {
            if (!sPhones.has(mPhone)) {
              const makePrimary = !hasPrimary;
              await tx.insert(parents).values({
                studentId,
                name: mName,
                phone: mPhone,
                email: mEmail,
                relationship: "Mother",
                isPrimary: makePrimary,
              });
              sPhones.add(mPhone);
              if (makePrimary) {
                hasPrimary = true;
                hasPrimaryByStudent.set(studentId, true);
              }
              parentsInserted++;
            }
          } else {
            const nameDiff = mName !== currMother.name;
            const phoneDiff = mPhone !== currMother.phone;
            const emailDiff = mEmail && mEmail !== currMother.email;

            if (nameDiff || phoneDiff || emailDiff) {
              if (phoneDiff && sPhones.has(mPhone)) {
                if (nameDiff || emailDiff) {
                  await tx.update(parents).set({
                    name: mName,
                    email: mEmail ?? currMother.email,
                    updatedAt: new Date(),
                  }).where(eq(parents.id, currMother.id));
                  parentsUpdated++;
                }
              } else {
                sPhones.delete(currMother.phone);
                sPhones.add(mPhone);
                await tx.update(parents).set({
                  name: mName,
                  phone: mPhone,
                  email: mEmail ?? currMother.email,
                  updatedAt: new Date(),
                }).where(eq(parents.id, currMother.id));
                parentsUpdated++;
              }
            }
          }
        }
      }
    }

    console.log("\nTransaction successfully COMMITTED to production DB!");
    console.log(`  Users inserted: ${usersInserted}`);
    console.log(`  Users updated: ${usersUpdated}`);
    console.log(`  Roles assigned: ${rolesAssigned}`);
    console.log(`  Students inserted: ${studentsInserted}`);
    console.log(`  Students updated: ${studentsUpdated}`);
    console.log(`  Parents inserted: ${parentsInserted}`);
    console.log(`  Parents updated: ${parentsUpdated}`);
  });

  // Verify final counts
  const finalStudents = await db.select().from(students);
  const finalParents = await db.select().from(parents);
  const finalUsers = await db.select().from(users);

  console.log("\n=== PRODUCTION DB FINAL STATUS ===");
  console.log(`Total Users: ${finalUsers.length}`);
  console.log(`Total Students: ${finalStudents.length}`);
  console.log(`Total Parents: ${finalParents.length}`);
}

runProductionSync()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL ERROR DURING SYNC:", err);
    process.exit(1);
  });

import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { AuthenticationError } from "@/lib/errors";
import { PARENT_JWT_COOKIE, verifyParentJwt } from "@/lib/jwt";

export async function getParentProfile(cookieHeader: string) {
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );

  const token = cookies[PARENT_JWT_COOKIE];
  if (!token) throw new AuthenticationError("Not authenticated");

  const payload = await verifyParentJwt(token);
  const parent = await parentRepository.findById(payload.sub);
  if (!parent) throw new AuthenticationError("Parent not found");

  return {
    id: parent.id,
    name: parent.name,
    phone: parent.phone,
    email: parent.email,
    relationship: parent.relationship,
    studentId: parent.studentId,
    isPrimary: parent.isPrimary,
  };
}

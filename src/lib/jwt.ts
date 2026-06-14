import { SignJWT, jwtVerify } from "jose";

import { AuthenticationError, ConfigurationError } from "@/lib/errors";

const getSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new ConfigurationError("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
};

export type ParentJwtPayload = {
  sub: string;
  phone: string;
  type: "parent";
};

export async function signParentJwt(
  parentId: string,
  phone: string
): Promise<string> {
  return new SignJWT({ sub: parentId, phone, type: "parent" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyParentJwt(
  token: string
): Promise<ParentJwtPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"],
  });

  if (payload.type !== "parent") {
    throw new AuthenticationError("Invalid token type");
  }

  return {
    sub: payload.sub as string,
    phone: payload.phone as string,
    type: "parent",
  };
}

export const PARENT_JWT_COOKIE = "parent_session";
export const PARENT_JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

import { type NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return new NextResponse("Token is required", { status: 400 });
    }

    // Generate QR code as PNG buffer
    const qrCodeBuffer = await QRCode.toBuffer(`https://sst-hostel-leave-phi.vercel.app/movements/scan?token=${token}`, {
      width: 512,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });

    // Return the QR code as a PNG image with proper caching headers
    return new NextResponse(new Uint8Array(qrCodeBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("QR code generation failed:", error);
    return new NextResponse("Failed to generate QR code", { status: 500 });
  }
}

export const runtime = "edge";
export const dynamic = "force-static";
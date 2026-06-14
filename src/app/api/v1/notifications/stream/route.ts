import { requireAuth } from "@/lib/auth/require-auth";

export async function GET(request: Request) {
  try {
    const currentUser = await requireAuth();

    const userId = currentUser.id;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected", userId })}\n\n`)
        );

        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            // client disconnected
          }
        }, 15_000);

        const safeTimeout = setTimeout(() => {
          clearInterval(heartbeat);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "timeout" })}\n\n`)
          );
          controller.close();
        }, 55_000);

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          clearTimeout(safeTimeout);
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: "Unauthorized" })}\n\n`,
      {
        status: 401,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }
}

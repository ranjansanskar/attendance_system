import { ImageResponse } from "next/og";

/** App icon: white "RT" on blue. Rendered at build time. */
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
          color: "white",
          fontSize: size * 0.36,
          fontWeight: 700,
          letterSpacing: -size * 0.01,
        }}
      >
        RT
      </div>
    ),
    { width: size, height: size },
  );
}

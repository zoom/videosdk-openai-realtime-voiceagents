'use client';

import dynamic from "next/dynamic";

// The Videocall component is imported dynamically as it uses the Zoom Video SDK that needs access to the browser environment
const Videochat = dynamic<{ slug: string; JWT: string }>(() => import("./Videochat"), { ssr: false });

export default function VideochatClientWrapper({ slug, JWT }: { slug: string; JWT: string }) {
    return (
        <Videochat slug={slug} JWT={JWT} />
    );
} 
import React, { Suspense } from "react";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import App from "./App";
import { getData } from "@/data/getToken";

export default async function Page() {
  const jwt = await getData("test");
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TranscriptProvider>
        <EventProvider>
          <App jwt={jwt} />
        </EventProvider>
      </TranscriptProvider>
    </Suspense>
  );
}

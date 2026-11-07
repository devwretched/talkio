"use client";

import { useParams } from "next/navigation";
import { ChatView } from "@/components/chat-view";

/** FREQUENCY with an active room id from the URL. */
export default function FrequencyRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params?.id ? Number(params.id) : undefined;
  return <ChatView roomId={roomId} />;
}

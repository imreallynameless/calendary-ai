"use client";

import { Box, Stack } from "@mui/material";
import { useEffect, useRef } from "react";
import { ConversationMessage, MessageBubble } from "@/app/_components/message-bubble";

type MessageListProps = {
  messages: ConversationMessage[];
};

export function MessageList({ messages }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <Box
      ref={viewportRef}
      sx={{
        height: "100%",
        overflow: "auto",
        p: 2,
      }}
    >
      <Stack spacing={2}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </Stack>
    </Box>
  );
}


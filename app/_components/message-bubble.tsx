"use client";

import { Box, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";

type MessageRole = "system" | "user" | "assistant";

export type ConversationMessage = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
};

const roleStyles: Record<
  MessageRole,
  {
    align: "flex-start" | "flex-end" | "center";
    backgroundColor: string;
    color: string;
    border: string;
  }
> = {
  system: {
    align: "center",
    backgroundColor: "#e3f2fd",
    color: "#000000",
    border: "1px solid #bbdefb",
  },
  assistant: {
    align: "flex-start",
    backgroundColor: "#f3e5f5",
    color: "#000000",
    border: "1px solid #ce93d8",
  },
  user: {
    align: "flex-end",
    backgroundColor: "#3f51b5",
    color: "#ffffff",
    border: "none",
  },
};

type MessageBubbleProps = {
  message: ConversationMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const style = roleStyles[message.role];
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const formattedTimestamp = isClient ? formatTimestamp(message.timestamp) : "";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: style.align,
        gap: 1,
        maxWidth: "100%",
      }}
    >
      <Paper
        elevation={message.role === "user" ? 3 : 1}
        sx={{
          p: 2,
          borderRadius: 2,
          backgroundColor: style.backgroundColor,
          color: style.color,
          border: style.border,
          maxWidth: "100%",
        }}
      >
        <Typography
          sx={{
            whiteSpace: "pre-wrap",
            color: style.color,
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          {message.content}
        </Typography>
      </Paper>
      {formattedTimestamp ? (
        <Typography
          variant="caption"
          sx={{
            color: "#000000",
            fontSize: "0.75rem",
          }}
        >
          {formattedTimestamp}
        </Typography>
      ) : null}
    </Box>
  );
}

function formatTimestamp(timestamp: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}


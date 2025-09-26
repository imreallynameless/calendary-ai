"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import { CalendarToday, Logout, Send } from "@mui/icons-material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ShieldIcon from "@mui/icons-material/Shield";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { MessageList } from "@/app/_components/message-list";
import type { ConversationMessage } from "@/app/_components/message-bubble";

type SubmissionState = "idle" | "submitting";
type AuthState = "loading" | "connected" | "disconnected";
type GeminiState = "unavailable" | "enabled" | "needsConsent";

const initialSystemMessage: ConversationMessage = {
  id: "system-hello",
  role: "assistant",
  content:
    "Paste a meeting-request email and I'll fetch your availability to suggest 2–3 viable times with a reply draft.",
  timestamp: "pending",
};

export default function HomePage() {
  const [messages, setMessages] = useState<ConversationMessage[]>(() => [
    initialSystemMessage,
  ]);
  const [draftEmail, setDraftEmail] = useState("");
  const [meetingDurationMinutes, setMeetingDurationMinutes] = useState(45);
  const [status, setStatus] = useState<SubmissionState>("idle");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [geminiState, setGeminiState] = useState<GeminiState>("unavailable");
  const [geminiDisclosureOpen, setGeminiDisclosureOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "privacy">("calendar");

  const geminiVisible = geminiState !== "unavailable";

  const canSubmit = useMemo(
    () => draftEmail.trim().length > 0 && status === "idle" && authState === "connected",
    [draftEmail, status, authState],
  );

  const appendAssistantReply = useCallback((payload: { summary: string; proposedSlots: { label: string; start: string; end: string }[]; replyDraft: string }) => {
    const replyId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-summary-${replyId}`,
        role: "assistant",
        content: buildAssistantSummary(payload),
        timestamp,
      },
    ]);
  }, []);

  const handleSubmit = useCallback(
    async (useGemini = false) => {
      if (!canSubmit) {
        return;
      }

      const now = new Date().toISOString();
      const userId = crypto.randomUUID();
      const userMessage: ConversationMessage = {
        id: `user-${userId}`,
        role: "user",
        content: draftEmail.trim(),
        timestamp: now,
      };

      setMessages((prev) => [...prev, userMessage]);
      setStatus("submitting");

      try {
        const response = await fetch("/api/availability", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            emailBody: draftEmail,
            durationMinutes: meetingDurationMinutes,
            useGemini,
          }),
        });

        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        const data = (await response.json()) as { summary: string; proposedSlots: { label: string; start: string; end: string }[]; replyDraft: string };
        appendAssistantReply(data);
      } catch (error) {
        console.error("Failed to generate proposals", error);
        appendAssistantReply({
          summary: "I hit an error when reaching the calendar service.",
          proposedSlots: [],
          replyDraft: "I could not access the calendar; please try again shortly.",
        });
      } finally {
        setStatus("idle");
        setDraftEmail("");
      }
    },
    [appendAssistantReply, canSubmit, draftEmail, meetingDurationMinutes],
  );

  useEffect(() => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === initialSystemMessage.id
          ? { ...message, timestamp: new Date().toISOString() }
          : message,
      ),
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/status", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Status check failed ${response.status}`);
        }
        const data = (await response.json()) as {
          authenticated: boolean;
          error?: string;
          gemini?: { available: boolean; consent?: boolean };
        };
        if (!mounted) {
          return;
        }
        setAuthState(data.authenticated ? "connected" : "disconnected");
        setAuthError(data.error ?? null);
        if (data.gemini?.available) {
          setGeminiState(data.gemini.consent ? "enabled" : "needsConsent");
        } else {
          setGeminiState("unavailable");
        }
      } catch (error) {
        console.error("Failed to check auth status", error);
        if (mounted) {
          setAuthState("disconnected");
          setAuthError("Authentication check failed");
          setGeminiState("unavailable");
        }
      }
    }

    checkAuth();
    const interval = setInterval(checkAuth, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Sign-out failed ${response.status}`);
      }
      setAuthState("disconnected");
      setAuthError(null);
      setGeminiState("unavailable");
    } catch (error) {
      console.error("Failed to sign out", error);
      setAuthError("Could not disconnect. Try again.");
    }
  }, []);

  const handleGeminiGenerate = useCallback(async () => {
    if (geminiState === "needsConsent") {
      setGeminiDisclosureOpen(true);
      return;
    }
    void handleSubmit(true);
  }, [geminiState, handleSubmit]);

  const handleGeminiConsent = useCallback(async () => {
    setGeminiDisclosureOpen(false);
    setGeminiState("enabled");
    void handleSubmit(true);
  }, [handleSubmit]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(150deg, #f2f6ff 0%, #ffffff 100%)",
        p: 3,
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={4} alignItems="center">
          <Stack spacing={2} alignItems="center" sx={{ width: "100%" }}>
            <CalendarToday sx={{ fontSize: "2.5rem", color: "#7b1fa2" }} />
            <Typography
              variant="h3"
              component="h1"
              align="center"
              sx={{ color: "#000000", fontWeight: "bold" }}
            >
              Calendary Messaging Assistant
            </Typography>
            <Typography
              variant="body1"
              align="center"
              sx={{ color: "#000000", maxWidth: 520 }}
            >
              Paste the incoming request, and I&apos;ll propose meetings using your real calendar while keeping details private on this machine.
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <Chip
                label="Use Calendary"
                color={viewMode === "calendar" ? "secondary" : "default"}
                size="medium"
                onClick={() => setViewMode("calendar")}
                sx={{ color: "#000000", cursor: "pointer" }}
              />
              <Chip
                label="Privacy First"
                color={viewMode === "privacy" ? "secondary" : "default"}
                variant={viewMode === "privacy" ? "filled" : "outlined"}
                size="medium"
                onClick={() => setViewMode("privacy")}
                sx={{ color: "#000000", cursor: "pointer" }}
              />
            </Stack>
            <AuthIndicator state={authState} onDisconnect={handleSignOut} error={authError} />
          </Stack>

          {viewMode === "calendar" ? (
            <Paper
              elevation={8}
              sx={{
                width: "100%",
                p: 2,
                backgroundColor: "#f5f5f5",
              }}
            >
              <Stack spacing={2}>
                <Box
                  sx={{
                    height: 420,
                    borderRadius: 1,
                    p: 1,
                    backgroundColor: "white",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <MessageList messages={messages} />
                </Box>
                <Stack spacing={1}>
                  <TextField
                    label="Meeting request email"
                    helperText="Paste the incoming message. I keep it on this device."
                    placeholder="Hi, could we meet next week to discuss..."
                    multiline
                    rows={6}
                    value={draftEmail}
                    onChange={(event) => setDraftEmail(event.target.value)}
                    disabled={status === "submitting" || authState !== "connected"}
                    InputLabelProps={{
                      style: { color: "#000000", fontWeight: 600 },
                    }}
                    FormHelperTextProps={{
                      style: { color: "#000000" },
                    }}
                  />
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Typography
                        variant="body2"
                        sx={{ color: "#000000", fontWeight: 600 }}
                      >
                        Meeting length
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        {[30, 45, 60].map((option) => (
                          <Chip
                            key={option}
                            label={`${option} min`}
                            color="primary"
                            variant={
                              option === meetingDurationMinutes ? "filled" : "outlined"
                            }
                            onClick={() => setMeetingDurationMinutes(option)}
                            sx={{ cursor: "pointer", color: "#000000" }}
                          />
                        ))}
                      </Stack>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      {geminiVisible ? (
                        <Button
                          variant="outlined"
                          endIcon={<AutoAwesomeIcon />}
                          onClick={handleGeminiGenerate}
                          disabled={!canSubmit || status === "submitting"}
                          sx={{ textTransform: "none", color: "#7b1fa2" }}
                        >
                          Gemini draft
                        </Button>
                      ) : null}
                      <Button
                        variant="contained"
                        endIcon={<Send />}
                        onClick={() => handleSubmit(false)}
                        disabled={!canSubmit || status === "submitting"}
                        sx={{ color: "#ffffff" }}
                      >
                        Generate reply
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </Stack>
            </Paper>
          ) : (
            <VisibilityPanel geminiEnabled={geminiVisible} />
          )}

          <GeminiDisclosure
            open={geminiDisclosureOpen}
            onClose={() => setGeminiDisclosureOpen(false)}
            onConfirm={handleGeminiConsent}
          />

          {authError ? (
            <Typography variant="body2" sx={{ color: "#b71c1c" }}>
              {authError}
            </Typography>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}

function buildAssistantSummary({ summary, proposedSlots, replyDraft }: { summary: string; proposedSlots: { label: string; start: string; end: string }[]; replyDraft: string }) {
  const slotLines = proposedSlots
    .map((slot, index) => `${index + 1}. ${slot.label}`)
    .join("\n");

  return [summary, slotLines, "\n--\n", replyDraft].filter(Boolean).join("\n");
}

function AuthIndicator({
  state,
  onDisconnect,
  error,
}: {
  state: AuthState;
  onDisconnect: () => void;
  error: string | null;
}) {
  if (state === "loading") {
    return (
      <Paper elevation={0} sx={{ p: 1, width: "100%" }}>
        <Typography variant="body2" sx={{ color: "#000000", mb: 1 }}>
          Checking calendar connection…
        </Typography>
        <LinearProgress />
      </Paper>
    );
  }

  if (state === "connected") {
    return (
      <Stack spacing={1} alignItems="center">
        <Chip label="Google Calendar connected" color="success" size="medium" />
        <Button
          variant="outlined"
          startIcon={<Logout />}
          onClick={onDisconnect}
          sx={{ textTransform: "none" }}
        >
          Disconnect
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={1} alignItems="center">
      <Chip label="Calendar not connected" color="warning" variant="outlined" />
      {error ? (
        <Typography variant="body2" sx={{ color: "#b71c1c" }}>
          {error}
        </Typography>
      ) : null}
      <Button
        variant="outlined"
        component="a"
        href="/api/auth/google"
        sx={{ textTransform: "none" }}
      >
        Connect Google Calendar
      </Button>
    </Stack>
  );
}

function GeminiDisclosure({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Use Gemini to draft your reply?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Enabling this option will send the pasted email content and proposed meeting slots to
          Google&apos;s Gemini API. Google retains request data for up to 30 days for abuse monitoring.
          This draft will be processed according to Google&apos;s generative AI terms. Please ensure the
          content is appropriate to share.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          I understand
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function VisibilityPanel({ geminiEnabled }: { geminiEnabled: boolean }) {
  return (
    <Paper elevation={0} sx={{ width: "100%", background: "transparent" }}>
      <Accordion defaultExpanded sx={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <VisibilityIcon fontSize="small" />
            <Typography variant="subtitle1" fontWeight={600}>
              What I Can See and Why
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Calendary processes your data locally by default. Here&apos;s how your information moves in each step.
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <ShieldIcon fontSize="small" color="success" />
                <Typography variant="subtitle2">Draft reply (standard)</Typography>
              </Stack>
              <Divider sx={{ my: 1 }} />
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CloudOffIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Email text stays on your device"
                    secondary="We parse the request, extract timing cues, and delete the payload after generating the reply."
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CloudOffIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Calendar availability stays local"
                    secondary="We call Google Calendar for busy slots only (start/end). Nothing is sent elsewhere."
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <ShieldIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Reply draft is generated locally"
                    secondary="The message is composed from deterministic templates on this machine."
                  />
                </ListItem>
              </List>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <CloudUploadIcon fontSize="small" color={geminiEnabled ? "primary" : "disabled"} />
                <Typography variant="subtitle2">Gemini draft (optional)</Typography>
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary" mb={1}>
                When you click <Typography component="span" fontWeight={600}>Gemini draft</Typography>, you opt to send the following to Google&apos;s Gemini API:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CloudUploadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Email content"
                    secondary="The pasted message is transmitted to craft a polished reply."
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CloudUploadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Suggested meeting options"
                    secondary="We include the slot summaries so Gemini can reference them in the response."
                  />
                </ListItem>
              </List>
              <Typography variant="body2" color="text.secondary">
                Google retains Gemini requests for up to 30 days for abuse monitoring. No data is stored in Calendary beyond temporary processing.
              </Typography>
            </Paper>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}


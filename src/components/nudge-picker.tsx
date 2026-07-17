"use client";

import { useState } from "react";
import { sendNudge } from "@/app/sessions/[id]/actions";
import { NUDGE_PRESETS } from "@/lib/nudge-presets";

const CUSTOM_KEY = "__custom__";
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

type State = "idle" | "open" | "sending" | "sent" | "error";

type Props = {
  sessionId: string;
  initialLastSentAt: string | null;
};

export function NudgePicker({ sessionId, initialLastSentAt }: Props) {
  const withinWindow =
    initialLastSentAt !== null &&
    Date.now() - new Date(initialLastSentAt).getTime() < RATE_LIMIT_MS;

  const [uiState, setUiState] = useState<State>(withinWindow ? "sent" : "idle");
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [sentAt, setSentAt] = useState<Date | null>(
    withinWindow ? new Date(initialLastSentAt!) : null,
  );

  function hoursRemaining(from: Date) {
    const remaining = RATE_LIMIT_MS - (Date.now() - from.getTime());
    return Math.max(1, Math.ceil(remaining / 3_600_000));
  }

  function messageToSend() {
    if (selected === CUSTOM_KEY) return customText.trim();
    return selected ?? "";
  }

  function canSend() {
    if (selected === CUSTOM_KEY) return customText.trim().length > 0;
    return selected !== null;
  }

  async function handleSend() {
    const msg = messageToSend();
    if (!msg) return;
    setUiState("sending");
    const result = await sendNudge(sessionId, msg);
    if ("error" in result) {
      setErrorMsg(result.error);
      setUiState("error");
    } else {
      setSentAt(new Date());
      setUiState("sent");
      setSelected(null);
      setCustomText("");
    }
  }

  if (uiState === "sent") {
    return (
      <div className="mt-8">
        <p className="text-sm text-ink-soft">
          Nudge sent 💛
          {sentAt && (
            <span className="ml-2 text-ink-soft/60">
              · You can send another in {hoursRemaining(sentAt)} hour
              {hoursRemaining(sentAt) === 1 ? "" : "s"}
            </span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {uiState === "idle" || uiState === "error" ? (
        <>
          <button
            type="button"
            onClick={() => {
              setErrorMsg("");
              setUiState("open");
            }}
            className="rounded-xl border border-ink/20 px-5 py-2.5 text-sm text-ink-soft hover:border-ink/40 hover:text-ink transition-colors"
          >
            Send a nudge
          </button>
          {uiState === "error" && errorMsg && (
            <p className="mt-2 text-sm text-red-500">{errorMsg}</p>
          )}
        </>
      ) : null}

      {(uiState === "open" || uiState === "sending") && (
        <div className="rounded-xl border border-ink/15 bg-white/50 p-5">
          <p className="mb-4 text-sm font-medium text-ink">Choose a message</p>

          <div className="flex flex-col gap-2">
            {Object.entries(NUDGE_PRESETS).map(([key, text]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                  selected === key
                    ? "border-candle bg-candle/10 text-ink"
                    : "border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink"
                }`}
              >
                {text}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setSelected(CUSTOM_KEY)}
              className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                selected === CUSTOM_KEY
                  ? "border-candle bg-candle/10 text-ink"
                  : "border-ink/15 text-ink-soft hover:border-ink/30 hover:text-ink"
              }`}
            >
              Write your own…
            </button>

            {selected === CUSTOM_KEY && (
              <div className="mt-1">
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="Type your nudge here…"
                  className="w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 outline-none focus:border-ink/40 resize-none"
                />
                <p className="mt-1 text-xs text-ink-soft/60 tabular-nums">
                  {customText.length}/200
                </p>
                <p className="mt-1 text-xs text-ink-soft/50 italic">
                  A nudge is encouragement — save the real conversation for after the report.
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend() || uiState === "sending"}
              className="rounded-xl bg-ink px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {uiState === "sending" ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => {
                setUiState("idle");
                setSelected(null);
                setCustomText("");
              }}
              className="text-sm text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

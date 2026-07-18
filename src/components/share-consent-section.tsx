"use client";

import { useState } from "react";
import {
  approveShare,
  cancelShare,
  declineShare,
  requestShare,
} from "@/app/sessions/[id]/report/share-actions";

export type ShareStateProps =
  | { kind: "none" }
  | {
      kind: "pending_mine";
      shareConsentId: string;
      counselorEmail: string;
      partnerFirstName: string;
    }
  | {
      kind: "pending_theirs";
      shareConsentId: string;
      counselorEmail: string;
      requesterFirstName: string;
    }
  | { kind: "completed"; counselorEmail: string; sharedAt: string };

type Props = {
  sessionId: string;
  initialState: ShareStateProps;
};

export function ShareConsentSection({ sessionId, initialState }: Props) {
  const [state, setState] = useState<ShareStateProps>(initialState);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [emailInput, setEmailInput] = useState("");

  async function call<T>(fn: () => Promise<T>, onOk: (result: T) => void) {
    setLoading(true);
    setErrorMsg("");
    try {
      const result = await fn();
      if (result && typeof result === "object" && "error" in result) {
        setErrorMsg((result as { error: string }).error);
      } else {
        onOk(result);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2
        className="text-xl text-ink"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Share with a counselor
      </h2>

      {state.kind === "none" && (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            Both partners must approve before anything is sent. One-sided
            consent shares nothing.
          </p>
          <div className="mt-5 flex gap-3">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Counselor's email address"
              disabled={loading}
              className="flex-1 rounded-xl border border-ink/20 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/50 outline-none focus:border-ink/40"
            />
            <button
              type="button"
              disabled={loading || emailInput.trim() === ""}
              onClick={() =>
                call(
                  () => requestShare(sessionId, emailInput.trim()),
                  (result) => {
                    if ("shareConsentId" in result) {
                      setState({
                        kind: "pending_mine",
                        shareConsentId: result.shareConsentId,
                        counselorEmail: emailInput.trim(),
                        partnerFirstName: "your partner",
                      });
                    }
                  },
                )
              }
              className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {loading ? "Requesting…" : "Request share"}
            </button>
          </div>
          {errorMsg && <p className="mt-2 text-sm text-red-500">{errorMsg}</p>}
        </>
      )}

      {state.kind === "pending_mine" && (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            Waiting for{" "}
            <span className="font-medium text-ink">
              {state.partnerFirstName}
            </span>{" "}
            to approve.
          </p>
          <p className="mt-1 text-sm text-ink-soft/70">
            Requested for {state.counselorEmail}
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              call(
                () => cancelShare(sessionId, state.shareConsentId),
                () => setState({ kind: "none" }),
              )
            }
            className="mt-4 text-sm text-ink-soft hover:text-ink"
          >
            {loading ? "Cancelling…" : "Cancel request"}
          </button>
          {errorMsg && <p className="mt-2 text-sm text-red-500">{errorMsg}</p>}
        </>
      )}

      {state.kind === "pending_theirs" && (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            <span className="font-medium text-ink">
              {state.requesterFirstName}
            </span>{" "}
            wants to share this report with{" "}
            <span className="font-medium text-ink">{state.counselorEmail}</span>
            .
          </p>
          <p className="mt-1 text-sm text-ink-soft/70">
            Both partners must approve. You can review the report above before
            deciding.
          </p>
          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                call(
                  () => approveShare(sessionId, state.shareConsentId),
                  () =>
                    setState({
                      kind: "completed",
                      counselorEmail: state.counselorEmail,
                      sharedAt: new Date().toISOString(),
                    }),
                )
              }
              className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {loading ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                call(
                  () => declineShare(sessionId, state.shareConsentId),
                  () => setState({ kind: "none" }),
                )
              }
              className="text-sm text-ink-soft hover:text-ink"
            >
              Decline
            </button>
          </div>
          {errorMsg && <p className="mt-2 text-sm text-red-500">{errorMsg}</p>}
        </>
      )}

      {state.kind === "completed" && (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            This report was shared with{" "}
            <span className="font-medium text-ink">{state.counselorEmail}</span>
            {state.sharedAt
              ? ` on ${new Date(state.sharedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`
              : ""}
            .
          </p>
        </>
      )}
    </div>
  );
}

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

// Transient state for the multi-step login/enrollment flow. Deliberately held
// only in memory (not persisted): if the tab is reloaded mid-flow the user
// simply restarts, which is the safer behaviour for an auth handshake.
interface MfaFlowState {
  email: string | null;
  mfaToken: string | null;
  enrollmentToken: string | null;
  livenessToken: string | null;
  challenges: string[];
  perChallengeTimeout: number;
}

interface MfaFlowContextValue extends MfaFlowState {
  setEmail: (email: string | null) => void;
  setMfaToken: (t: string | null) => void;
  setEnrollmentToken: (t: string | null) => void;
  setLiveness: (token: string, challenges: string[], perChallengeTimeout: number) => void;
  reset: () => void;
}

const initial: MfaFlowState = {
  email: null,
  mfaToken: null,
  enrollmentToken: null,
  livenessToken: null,
  challenges: [],
  perChallengeTimeout: 25,
};

const MfaFlowContext = createContext<MfaFlowContextValue | undefined>(undefined);

export function MfaFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MfaFlowState>(initial);

  const setEmail = useCallback((email: string | null) => setState((s) => ({ ...s, email })), []);
  const setMfaToken = useCallback(
    (mfaToken: string | null) => setState((s) => ({ ...s, mfaToken })),
    []
  );
  const setEnrollmentToken = useCallback(
    (enrollmentToken: string | null) => setState((s) => ({ ...s, enrollmentToken })),
    []
  );
  const setLiveness = useCallback(
    (livenessToken: string, challenges: string[], perChallengeTimeout: number) =>
      setState((s) => ({ ...s, livenessToken, challenges, perChallengeTimeout })),
    []
  );
  const reset = useCallback(() => setState(initial), []);

  const value = useMemo<MfaFlowContextValue>(
    () => ({ ...state, setEmail, setMfaToken, setEnrollmentToken, setLiveness, reset }),
    [state, setEmail, setMfaToken, setEnrollmentToken, setLiveness, reset]
  );

  return <MfaFlowContext.Provider value={value}>{children}</MfaFlowContext.Provider>;
}

export function useMfaFlow(): MfaFlowContextValue {
  const ctx = useContext(MfaFlowContext);
  if (!ctx) throw new Error("useMfaFlow must be used within an MfaFlowProvider");
  return ctx;
}

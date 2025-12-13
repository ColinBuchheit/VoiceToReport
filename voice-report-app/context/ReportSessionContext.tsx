import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface ReportSessionValue {
	currentDraftId?: string;
	setCurrentDraftId: (id?: string) => void;
	inDraft: boolean;
	justExitedDraft: boolean;
	setJustExitedDraft: (v: boolean) => void;
}

const ReportSessionContext = createContext<ReportSessionValue | undefined>(undefined);

export function ReportSessionProvider({ children }: { children: ReactNode }) {
	const [currentDraftId, setCurrentDraftIdState] = useState<string | undefined>(undefined);
	const [justExitedDraft, setJustExitedDraft] = useState<boolean>(false);

	const setCurrentDraftId = (id?: string) => setCurrentDraftIdState(id);

	const value = useMemo<ReportSessionValue>(() => ({
		currentDraftId,
		setCurrentDraftId,
		inDraft: !!currentDraftId,
			justExitedDraft,
			setJustExitedDraft,
		}), [currentDraftId, justExitedDraft]);

	return (
		<ReportSessionContext.Provider value={value}>
			{children}
		</ReportSessionContext.Provider>
	);
}

export function useReportSession() {
	const ctx = useContext(ReportSessionContext);
	if (!ctx) throw new Error('useReportSession must be used within a ReportSessionProvider');
	return ctx;
}


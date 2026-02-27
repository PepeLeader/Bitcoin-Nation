import type { CollectionUploadState } from '../../types/nft';

interface CollectionUploadProgressProps {
    readonly state: CollectionUploadState;
    readonly onCancel: () => void;
}

type StepStatus = 'pending' | 'active' | 'done';

function stepClass(status: StepStatus): string {
    if (status === 'active') return 'deploy-step deploy-step--active';
    if (status === 'done') return 'deploy-step deploy-step--done';
    return 'deploy-step';
}

function indicator(status: StepStatus): React.JSX.Element {
    if (status === 'active') return <div className="deploy-step__spinner" />;
    if (status === 'done') {
        return (
            <div className="deploy-step__indicator">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </div>
        );
    }
    return (
        <div className="deploy-step__indicator">
            <div className="deploy-step__dot" />
        </div>
    );
}

function progressText(completed: number, total: number): string {
    if (total === 0) return '';
    return ` (${completed} / ${total})`;
}

export function CollectionUploadProgress({ state, onCancel }: CollectionUploadProgressProps): React.JSX.Element {
    const { phase, imageProgress, metadataProgress } = state;

    const imageStatus: StepStatus =
        phase === 'uploading-images' ? 'active' : phase === 'uploading-metadata' || phase === 'done' ? 'done' : 'pending';

    const metadataStatus: StepStatus = phase === 'uploading-metadata' ? 'active' : phase === 'done' ? 'done' : 'pending';

    const canCancel = phase === 'uploading-images' || phase === 'uploading-metadata';

    return (
        <div className="deploy-overlay">
            <div className="deploy-overlay__card">
                <div className="deploy-overlay__title">Uploading Collection</div>
                <div className="deploy-steps">
                    <div className={stepClass(imageStatus)}>
                        {indicator(imageStatus)}
                        <span className="deploy-step__label">
                            Upload images{progressText(imageProgress.completed, imageProgress.total)}
                        </span>
                    </div>
                    <div className={stepClass(metadataStatus)}>
                        {indicator(metadataStatus)}
                        <span className="deploy-step__label">
                            Upload metadata{progressText(metadataProgress.completed, metadataProgress.total)}
                        </span>
                    </div>
                </div>
                {phase === 'error' && state.error && (
                    <div className="upload-error">
                        <div className="upload-error__message">{state.error}</div>
                        {state.failedItems.length > 0 && (
                            <ul className="upload-error__list">
                                {state.failedItems.map((item) => (
                                    <li key={item.index} className="upload-error__item">
                                        <span className="upload-error__name">{item.name}</span>
                                        <span className="upload-error__detail">{item.error}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                {canCancel && (
                    <button type="button" className="btn btn-secondary" style={{ marginTop: 'var(--space-lg)', width: '100%' }} onClick={onCancel}>
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
}

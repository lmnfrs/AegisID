interface ExpiredLinkViewProps {
  purpose: 'enroll' | 'recover';
  onRequestNewLink?: () => void;
}

export default function ExpiredLinkView({ purpose, onRequestNewLink }: ExpiredLinkViewProps) {
  const isEnroll = purpose === 'enroll';

  return (
    <div className="stack" style={{ alignItems: 'center', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
      <h3>Link expired or invalid</h3>

      <div className="alert alert--error" style={{ textAlign: 'left', fontSize: '13px', width: '100%' }}>
        The Magic Link is only valid for a short period of time (about 10 minutes) to ensure the security of your account.
      </div>

      {isEnroll ? (
        <p style={{ fontSize: '14px', color: 'var(--fg-muted)', margin: 0 }}>
          Please contact your organization's <b>Administrator</b> to get a new account activation link.
        </p>
      ) : (
        <div className="stack" style={{ width: '100%', alignItems: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--fg-muted)', margin: 0 }}>
            You can go back to the first step to request a new recovery link.
          </p>
          {onRequestNewLink && (
            <button type="button" className="btn btn--primary btn--block" onClick={onRequestNewLink}>
                Request new recovery link
            </button>
          )}
        </div>
      )}
    </div>
  );
}
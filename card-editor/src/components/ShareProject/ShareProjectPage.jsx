import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const ShareProjectPage = () => {
  const navigate = useNavigate();
  const { token, lng } = useParams();
  const startedRef = useRef(false);
  const [state, setState] = useState({ status: 'loading', message: 'Opening shared project...' });

  const editorPath = lng ? `/${lng}/online-sign-editor` : '/online-sign-editor';

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const openSharedProject = async () => {
      const shareToken = String(token || '').trim();
      if (!shareToken) {
        setState({ status: 'error', message: 'Invalid share link' });
        return;
      }

      try {
        sessionStorage.setItem('pendingSharedProjectToken', shareToken);
      } catch {
        try {
          localStorage.setItem('pendingSharedProjectToken', shareToken);
        } catch {}
      }

      navigate(editorPath, { replace: true });
    };

    openSharedProject();
  }, [editorPath, navigate, token]);

  if (state.status === 'loading') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>Opening shared project</h2>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h2 style={{ marginBottom: 8 }}>Unable to open share link</h2>
      <p style={{ marginBottom: 16 }}>{state.message}</p>
      <button type="button" onClick={() => navigate(editorPath, { replace: true })}>
        Go to editor
      </button>
    </div>
  );
};

export default ShareProjectPage;

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchSharedProjectByToken, markSharedProjectCopied } from '../../http/share';
import { getProject, putProject, uuid } from '../../utils/projectStorage';

const MAX_CANVASES = 30;

const deepClone = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const ShareProjectPage = () => {
  const navigate = useNavigate();
  const { token, lng } = useParams();
  const startedRef = useRef(false);
  const [state, setState] = useState({ status: 'loading', message: 'Opening shared project...' });

  const homePath = lng ? `/${lng}` : '/';

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const openSharedProject = async () => {
      const shareToken = String(token || '').trim();
      if (!shareToken) {
        setState({ status: 'error', message: 'Invalid share link' });
        return;
      }

      const importedKey = `shared:imported:${shareToken}`;

      try {
        const existingImportedId = localStorage.getItem(importedKey);
        if (existingImportedId) {
          const existingProject = await getProject(existingImportedId);
          if (existingProject) {
            const firstCanvas = Array.isArray(existingProject.canvases)
              ? existingProject.canvases[0]
              : null;

            localStorage.setItem('currentProjectId', existingProject.id);
            localStorage.setItem('currentProjectName', existingProject.name || '');
            if (firstCanvas?.id) {
              localStorage.setItem('currentCanvasId', firstCanvas.id);
              localStorage.setItem('currentProjectCanvasId', firstCanvas.id);
              localStorage.setItem('currentProjectCanvasIndex', '0');
              localStorage.removeItem('currentUnsavedSignId');
            }

            try {
              window.dispatchEvent(
                new CustomEvent('project:switched', { detail: { projectId: existingProject.id } })
              );
              window.dispatchEvent(
                new CustomEvent('project:opened', { detail: { projectId: existingProject.id } })
              );
            } catch {}

            navigate(homePath, { replace: true });
            return;
          }
        }
      } catch {}

      try {
        const shared = await fetchSharedProjectByToken(shareToken);
        const sourceProject =
          shared?.project && typeof shared.project === 'object' ? deepClone(shared.project) : null;

        if (!sourceProject) {
          setState({ status: 'error', message: 'Shared project data is empty' });
          return;
        }

        const now = Date.now();
        const nextProjectId = uuid();
        const sourceCanvases = Array.isArray(sourceProject.canvases)
          ? sourceProject.canvases.slice(0, MAX_CANVASES)
          : [];

        const clonedCanvases = sourceCanvases.map((canvasEntry) => {
          const safeCanvas = canvasEntry && typeof canvasEntry === 'object' ? canvasEntry : {};
          return {
            ...safeCanvas,
            id: uuid(),
          };
        });

        if (clonedCanvases.length === 0) {
          setState({ status: 'error', message: 'Shared project has no canvases to open' });
          return;
        }

        const baseName = String(shared?.projectName || sourceProject?.name || 'Shared project').trim();
        const nextProject = {
          ...sourceProject,
          id: nextProjectId,
          name: `${baseName} (copy)`,
          createdAt: now,
          updatedAt: now,
          lastOrderedAt: 0,
          canvases: clonedCanvases,
        };

        await putProject(nextProject);

        const firstCanvas = clonedCanvases[0];
        localStorage.setItem('currentProjectId', nextProject.id);
        localStorage.setItem('currentProjectName', nextProject.name || '');
        localStorage.setItem('currentCanvasId', firstCanvas.id);
        localStorage.setItem('currentProjectCanvasId', firstCanvas.id);
        localStorage.setItem('currentProjectCanvasIndex', '0');
        localStorage.removeItem('currentUnsavedSignId');
        localStorage.setItem(importedKey, nextProject.id);

        try {
          await markSharedProjectCopied(shareToken);
        } catch {}

        try {
          window.dispatchEvent(
            new CustomEvent('project:switched', { detail: { projectId: nextProject.id } })
          );
          window.dispatchEvent(
            new CustomEvent('project:opened', { detail: { projectId: nextProject.id } })
          );
        } catch {}

        navigate(homePath, { replace: true });
      } catch (error) {
        console.error('Failed to open shared project', error);
        setState({ status: 'error', message: 'Failed to open shared project. The link may be expired.' });
      }
    };

    openSharedProject();
  }, [homePath, navigate, token]);

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
      <button type="button" onClick={() => navigate(homePath, { replace: true })}>
        Go to editor
      </button>
    </div>
  );
};

export default ShareProjectPage;

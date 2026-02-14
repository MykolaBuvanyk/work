import { Navigate, useLocation } from 'react-router-dom';

const resolveRootPath = (pathname) => {
  const m = String(pathname || '').match(/^\/([a-z]{2})(\/|$)/i);
  return m ? `/${m[1]}` : '/';
};

export default function RequireSavedProject({ children }) {
  const location = useLocation();

  let hasSavedProject = false;
  try {
    const currentProjectId = String(localStorage.getItem('currentProjectId') || '').trim();
    hasSavedProject = currentProjectId.length > 0;
  } catch {
    hasSavedProject = false;
  }

  if (!hasSavedProject) {
    return <Navigate to={resolveRootPath(location.pathname)} replace />;
  }

  return children;
}

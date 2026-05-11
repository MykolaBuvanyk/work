import { useNavigate } from 'react-router-dom';
import { getLocalizedPath } from '../utils/localizedPath';

export default function useLocalizedNavigate() {
  const navigate = useNavigate();

  return (to, options) => {
    navigate(getLocalizedPath(to), options);
  };
}
import { useNavigate as UseRealNavigate } from 'react-router-dom';
import { getLocalizedPath } from '../../utils/localizedPath';

export default function useNavigate() {
  const navigate = UseRealNavigate();

  return (to, options) => {
    navigate(getLocalizedPath(to), options);
  };
}